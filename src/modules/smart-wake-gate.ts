/**
 * Smart Wake Gate — Idle agent suppression
 *
 * Problem: In multi-agent systems, idle agents still consume tokens
 * by being included in every orchestration loop even when irrelevant.
 *
 * Solution: Gate agent activation based on relevance scoring.
 * Only wake agents that are likely needed for the current task,
 * suppressing token spend on idle agents.
 */

import { countTokens } from '../utils/token-counter';

export interface SmartWakeGateOptions {
  /** Minimum relevance score to wake an agent (0-1, default: 0.3) */
  wakeThreshold?: number;
  /** Max idle time before auto-sleep in ms (default: 5 minutes) */
  idleTimeoutMs?: number;
  /** Max concurrently awake agents (default: 5) */
  maxAwake?: number;
}

export interface AgentProfile {
  id: string;
  name: string;
  /** Keywords that indicate this agent should wake */
  triggerKeywords: string[];
  /** Tool names this agent provides */
  toolNames: string[];
  /** System prompt token count (cost of waking this agent) */
  systemPromptTokens?: number;
}

interface AgentState {
  profile: AgentProfile;
  isAwake: boolean;
  lastActiveAt: number;
  wakeCount: number;
  totalTokensCost: number;
  suppressedCount: number;
}

const DEFAULT_OPTIONS: Required<SmartWakeGateOptions> = {
  wakeThreshold: 0.3,
  idleTimeoutMs: 5 * 60 * 1000,
  maxAwake: 5,
};

export class SmartWakeGate {
  private agents = new Map<string, AgentState>();
  private options: Required<SmartWakeGateOptions>;
  private totalTokensSaved = 0;

  constructor(options: SmartWakeGateOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Register an agent with the gate
   */
  register(profile: AgentProfile): void {
    this.agents.set(profile.id, {
      profile,
      isAwake: false,
      lastActiveAt: 0,
      wakeCount: 0,
      totalTokensCost: 0,
      suppressedCount: 0,
    });
  }

  /**
   * Determine which agents should be active for a given message
   * Returns agent IDs that should be awake
   */
  evaluate(userMessage: string, activeToolNames?: string[]): string[] {
    this.sleepIdleAgents();

    const scored: Array<{ id: string; score: number; cost: number }> = [];

    for (const [id, state] of this.agents) {
      const score = this.scoreRelevance(state.profile, userMessage, activeToolNames);
      scored.push({
        id,
        score,
        cost: state.profile.systemPromptTokens || 0,
      });
    }

    // Sort by score desc, then by cost asc (prefer cheaper agents at same relevance)
    scored.sort((a, b) => b.score - a.score || a.cost - b.cost);

    const toWake: string[] = [];
    for (const item of scored) {
      if (item.score >= this.options.wakeThreshold && toWake.length < this.options.maxAwake) {
        toWake.push(item.id);
        const state = this.agents.get(item.id)!;
        state.isAwake = true;
        state.lastActiveAt = Date.now();
        state.wakeCount++;
      } else {
        const state = this.agents.get(item.id)!;
        if (state.isAwake) {
          state.isAwake = false;
          state.suppressedCount++;
          this.totalTokensSaved += state.profile.systemPromptTokens || 0;
        } else {
          state.suppressedCount++;
          this.totalTokensSaved += state.profile.systemPromptTokens || 0;
        }
      }
    }

    return toWake;
  }

  /**
   * Score how relevant an agent is to the current message
   */
  private scoreRelevance(
    profile: AgentProfile,
    userMessage: string,
    activeToolNames?: string[]
  ): number {
    const messageLower = userMessage.toLowerCase();
    let score = 0;

    // Keyword matching: any match gives a strong signal
    if (profile.triggerKeywords.length > 0) {
      const matches = profile.triggerKeywords.filter(kw =>
        messageLower.includes(kw.toLowerCase())
      ).length;
      if (matches > 0) {
        score += 0.3 + (matches / profile.triggerKeywords.length) * 0.4;
      }
    }

    // Tool name matching: bonus if tools are actively referenced
    if (activeToolNames && profile.toolNames.length > 0) {
      const toolMatches = profile.toolNames.filter(tn =>
        activeToolNames.includes(tn) || messageLower.includes(tn.toLowerCase())
      ).length;
      if (toolMatches > 0) {
        score += 0.2 + (toolMatches / profile.toolNames.length) * 0.2;
      }
    }

    return Math.min(score, 1.0);
  }

  private sleepIdleAgents(): void {
    const now = Date.now();
    for (const [, state] of this.agents) {
      if (state.isAwake && now - state.lastActiveAt > this.options.idleTimeoutMs) {
        state.isAwake = false;
      }
    }
  }

  getAwakeAgents(): string[] {
    return Array.from(this.agents.entries())
      .filter(([, s]) => s.isAwake)
      .map(([id]) => id);
  }

  getStats() {
    const agents = Array.from(this.agents.values());
    return {
      registered: agents.length,
      awake: agents.filter(a => a.isAwake).length,
      totalWakes: agents.reduce((sum, a) => sum + a.wakeCount, 0),
      totalSuppressed: agents.reduce((sum, a) => sum + a.suppressedCount, 0),
      totalTokensSaved: this.totalTokensSaved,
    };
  }
}
