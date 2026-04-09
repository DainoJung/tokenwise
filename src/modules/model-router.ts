/**
 * Model Router — Route requests to cost-appropriate models
 *
 * Problem: Agentic systems use expensive models for everything,
 * but 60-70% of tasks are simple (formatting, extraction, lookup).
 *
 * Solution: Classify request complexity and route to the cheapest
 * model that can handle it. gpt-4o-mini handles simple tasks at 16x
 * less cost than gpt-4o.
 *
 * Routing tiers:
 * - Simple: short input, no tools, extraction/formatting → nano/mini
 * - Moderate: medium input, few tools, analysis → mini/standard
 * - Complex: long input, many tools, reasoning/planning → standard/premium
 */

import type { ChatMessage, CompressedTool, RoutingRule } from '../types';
import { countMessageTokens, countToolTokens } from '../utils/token-counter';

export interface ModelRouterOptions {
  /** Default model if routing is disabled */
  defaultModel?: string;
  /** Custom routing rules (overrides built-in) */
  rules?: RoutingRule[];
  /** Models allowed for routing (whitelist) */
  allowedModels?: string[];
  /** Never route these models (e.g., already using cheap model) */
  skipModels?: string[];
}

interface ComplexityScore {
  level: 'simple' | 'moderate' | 'complex';
  score: number;
  reasons: string[];
}

// Built-in routing map: requested model → cheaper alternatives
const DOWNGRADE_MAP: Record<string, Record<string, string>> = {
  'gpt-4o': {
    simple: 'gpt-4.1-nano',
    moderate: 'gpt-4.1-mini',
    complex: 'gpt-4o',
  },
  'gpt-4o-2024-11-20': {
    simple: 'gpt-4.1-nano',
    moderate: 'gpt-4.1-mini',
    complex: 'gpt-4o',
  },
  'gpt-4.1': {
    simple: 'gpt-4.1-nano',
    moderate: 'gpt-4.1-mini',
    complex: 'gpt-4.1',
  },
  'gpt-5': {
    simple: 'gpt-5-mini',
    moderate: 'gpt-5-mini',
    complex: 'gpt-5',
  },
  'o3': {
    simple: 'gpt-4.1-mini',
    moderate: 'o4-mini',
    complex: 'o3',
  },
  // Claude models
  'claude-opus-4-6': {
    simple: 'claude-haiku-4-5',
    moderate: 'claude-sonnet-4-6',
    complex: 'claude-opus-4-6',
  },
  'claude-sonnet-4-6': {
    simple: 'claude-haiku-4-5',
    moderate: 'claude-sonnet-4-6',
    complex: 'claude-sonnet-4-6',
  },
};

const DEFAULT_OPTIONS: Required<ModelRouterOptions> = {
  defaultModel: 'gpt-4o',
  rules: [],
  allowedModels: [],
  skipModels: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-5-mini', 'o4-mini', 'claude-haiku-4-5'],
};

export class ModelRouter {
  private options: Required<ModelRouterOptions>;
  private routingHistory: Array<{ from: string; to: string; complexity: string; timestamp: number }> = [];

  constructor(options: ModelRouterOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Determine the best model for this request
   */
  route(
    requestedModel: string,
    messages: ChatMessage[],
    tools?: CompressedTool[]
  ): { model: string; complexity: ComplexityScore; wasRouted: boolean } {
    // Skip if already using a cheap model
    if (this.options.skipModels.includes(requestedModel)) {
      return {
        model: requestedModel,
        complexity: { level: 'simple', score: 0, reasons: ['already-cheap-model'] },
        wasRouted: false,
      };
    }

    // Classify complexity
    const complexity = this.classifyComplexity(messages, tools);

    // Find the appropriate model
    const downgradeMap = DOWNGRADE_MAP[requestedModel];
    if (!downgradeMap) {
      return { model: requestedModel, complexity, wasRouted: false };
    }

    const targetModel = downgradeMap[complexity.level] || requestedModel;

    // Check if target is in allowed models (if whitelist is set)
    if (this.options.allowedModels.length > 0 && !this.options.allowedModels.includes(targetModel)) {
      return { model: requestedModel, complexity, wasRouted: false };
    }

    const wasRouted = targetModel !== requestedModel;
    if (wasRouted) {
      this.routingHistory.push({
        from: requestedModel,
        to: targetModel,
        complexity: complexity.level,
        timestamp: Date.now(),
      });
    }

    return { model: targetModel, complexity, wasRouted };
  }

  /**
   * Classify the complexity of a request
   */
  private classifyComplexity(messages: ChatMessage[], tools?: CompressedTool[]): ComplexityScore {
    let score = 0;
    const reasons: string[] = [];

    // Factor 1: Message count and token count
    const tokenCount = countMessageTokens(messages);
    if (tokenCount > 4000) {
      score += 30;
      reasons.push('high-token-count');
    } else if (tokenCount > 1500) {
      score += 15;
      reasons.push('moderate-token-count');
    }

    // Factor 2: Number of tools
    const toolCount = tools?.length || 0;
    if (toolCount > 10) {
      score += 25;
      reasons.push('many-tools');
    } else if (toolCount > 3) {
      score += 10;
      reasons.push('some-tools');
    }

    // Factor 3: Last user message complexity
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg?.content) {
      const content = lastUserMsg.content;

      // Multi-step indicators
      if (/\b(then|after that|next|finally|step \d|first.*then)\b/i.test(content)) {
        score += 20;
        reasons.push('multi-step-request');
      }

      // Reasoning indicators (each match adds weight)
      const reasoningMatches = content.match(/\b(analyze|compare|evaluate|reason|think|consider|plan|design|architect|assess|trade-?off|pros?\s+(?:and|&)\s+cons?|recommend)\b/gi);
      if (reasoningMatches) {
        // Multiple reasoning keywords = higher complexity
        const reasoningScore = Math.min(reasoningMatches.length * 10, 40);
        score += reasoningScore;
        reasons.push(`reasoning-required(${reasoningMatches.length}x)`);
      }

      // Multi-factor analysis: listing multiple dimensions to consider
      const commaCount = (content.match(/,/g) || []).length;
      if (commaCount >= 3) {
        score += 15;
        reasons.push('multi-factor-analysis');
      }

      // Code generation indicators
      if (/\b(write|implement|create|build|code|function|class|component)\b/i.test(content)) {
        score += 10;
        reasons.push('code-generation');
      }

      // Long message = likely complex request
      if (content.length > 200) {
        score += 15;
        reasons.push('long-message');
      } else if (content.length > 100) {
        score += 5;
        reasons.push('medium-message');
      }

      // Simple task indicators (negative score)
      if (/\b(format|extract|convert|list|summarize|translate|count)\b/i.test(content)) {
        score -= 10;
        reasons.push('simple-task-indicator');
      }

      // Very short messages are likely simple
      if (content.length < 50) {
        score -= 15;
        reasons.push('short-message');
      } else if (content.length < 100) {
        score -= 5;
        reasons.push('brief-message');
      }
    }

    // Factor 4: System prompt complexity
    const systemMsg = messages.find(m => m.role === 'system');
    if (systemMsg?.content && systemMsg.content.length > 2000) {
      score += 10;
      reasons.push('complex-system-prompt');
    }

    // Factor 5: Conversation depth
    const turns = messages.filter(m => m.role === 'user').length;
    if (turns > 5) {
      score += 10;
      reasons.push('deep-conversation');
    }

    // Classify
    let level: 'simple' | 'moderate' | 'complex';
    if (score <= 15) {
      level = 'simple';
    } else if (score <= 40) {
      level = 'moderate';
    } else {
      level = 'complex';
    }

    return { level, score, reasons };
  }

  getRoutingHistory() {
    return this.routingHistory;
  }

  getRoutingSummary() {
    const total = this.routingHistory.length;
    const downgraded = this.routingHistory.filter(r => r.from !== r.to).length;
    return {
      totalRouted: total,
      downgraded,
      byComplexity: {
        simple: this.routingHistory.filter(r => r.complexity === 'simple').length,
        moderate: this.routingHistory.filter(r => r.complexity === 'moderate').length,
        complex: this.routingHistory.filter(r => r.complexity === 'complex').length,
      },
    };
  }
}
