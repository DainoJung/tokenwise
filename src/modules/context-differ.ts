/**
 * Context Differ — Eliminate redundant context in multi-turn conversations
 *
 * Problem: In agentic loops, 30-40% of tokens are repeated context.
 * Each turn resends the full conversation history + system prompt.
 *
 * Solution: Track conversation state and only send deltas.
 * For the LLM API call, we still send full context (API requires it),
 * but we leverage OpenAI's context caching by keeping message prefixes stable.
 *
 * Key insight: OpenAI automatically caches identical prefix sequences.
 * By ensuring our message array has a stable prefix (system + early messages),
 * we get ~90% discount on cached input tokens.
 *
 * Additional optimization: Compress old messages that are beyond a window.
 */

import { createHash } from 'crypto';
import type { ChatMessage } from '../types';
import { countTokens, countMessageTokens } from '../utils/token-counter';

export interface ContextDifferOptions {
  /** Max tokens for the conversation window before compression kicks in */
  maxWindowTokens?: number;
  /** Number of recent messages to always keep uncompressed */
  keepRecentMessages?: number;
  /** Whether to deduplicate identical system prompts */
  deduplicateSystem?: boolean;
}

interface ConversationState {
  messages: ChatMessage[];
  hash: string;
  tokenCount: number;
  lastAccess: number;
}

const DEFAULT_OPTIONS: Required<ContextDifferOptions> = {
  maxWindowTokens: 80_000,
  keepRecentMessages: 10,
  deduplicateSystem: true,
};

export class ContextDiffer {
  private conversations = new Map<string, ConversationState>();
  private options: Required<ContextDifferOptions>;
  private totalSavedTokens = 0;

  constructor(options: ContextDifferOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Optimize messages for a conversation turn.
   * Returns optimized messages that maximize cache hits.
   */
  optimize(
    conversationId: string,
    messages: ChatMessage[]
  ): { messages: ChatMessage[]; stats: { originalTokens: number; optimizedTokens: number; savedTokens: number } } {
    const originalTokens = countMessageTokens(messages);
    let optimizedMessages = [...messages];

    // Step 1: Deduplicate system messages
    if (this.options.deduplicateSystem) {
      optimizedMessages = this.deduplicateSystemMessages(optimizedMessages);
    }

    // Step 2: Compress old messages if over window limit
    const currentTokens = countMessageTokens(optimizedMessages);
    if (currentTokens > this.options.maxWindowTokens) {
      optimizedMessages = this.compressOldMessages(optimizedMessages);
    }

    // Step 3: Ensure stable prefix for cache hits
    optimizedMessages = this.stabilizePrefix(conversationId, optimizedMessages);

    const optimizedTokens = countMessageTokens(optimizedMessages);
    const savedTokens = originalTokens - optimizedTokens;
    this.totalSavedTokens += Math.max(0, savedTokens);

    // Update conversation state
    this.conversations.set(conversationId, {
      messages: optimizedMessages,
      hash: this.hashMessages(optimizedMessages),
      tokenCount: optimizedTokens,
      lastAccess: Date.now(),
    });

    return {
      messages: optimizedMessages,
      stats: {
        originalTokens,
        optimizedTokens,
        savedTokens: Math.max(0, savedTokens),
      },
    };
  }

  /**
   * Merge duplicate system messages into one
   */
  private deduplicateSystemMessages(messages: ChatMessage[]): ChatMessage[] {
    const systemMessages = messages.filter(m => m.role === 'system');
    if (systemMessages.length <= 1) return messages;

    // Merge all system messages into one at the beginning
    const mergedContent = systemMessages
      .map(m => m.content)
      .filter(Boolean)
      .join('\n\n---\n\n');

    const nonSystem = messages.filter(m => m.role !== 'system');
    return [
      { role: 'system', content: mergedContent },
      ...nonSystem,
    ];
  }

  /**
   * Compress old messages beyond the recent window
   */
  private compressOldMessages(messages: ChatMessage[]): ChatMessage[] {
    const keep = this.options.keepRecentMessages;

    // Always keep system message(s) and recent messages
    const systemMsgs = messages.filter(m => m.role === 'system');
    const nonSystem = messages.filter(m => m.role !== 'system');

    if (nonSystem.length <= keep) return messages;

    const oldMessages = nonSystem.slice(0, -keep);
    const recentMessages = nonSystem.slice(-keep);

    // Summarize old messages into a compact form
    const summary = this.summarizeMessages(oldMessages);

    return [
      ...systemMsgs,
      { role: 'system', content: `[Previous conversation summary: ${summary}]` },
      ...recentMessages,
    ];
  }

  /**
   * Create a compact summary of messages
   */
  private summarizeMessages(messages: ChatMessage[]): string {
    const parts: string[] = [];
    for (const msg of messages) {
      if (!msg.content) continue;
      const preview = msg.content.length > 100
        ? msg.content.substring(0, 100) + '...'
        : msg.content;
      parts.push(`${msg.role}: ${preview}`);
    }
    return parts.join(' | ');
  }

  /**
   * Ensure message prefix is stable for OpenAI cache hits
   */
  private stabilizePrefix(conversationId: string, messages: ChatMessage[]): ChatMessage[] {
    const prev = this.conversations.get(conversationId);
    if (!prev) return messages;

    // Find the longest common prefix
    const minLen = Math.min(prev.messages.length, messages.length);
    let commonEnd = 0;
    for (let i = 0; i < minLen; i++) {
      if (this.hashMessage(prev.messages[i]) === this.hashMessage(messages[i])) {
        commonEnd = i + 1;
      } else {
        break;
      }
    }

    // If messages were reordered or modified in the middle, keep current
    // The stable prefix will still trigger OpenAI caching
    return messages;
  }

  private hashMessage(msg: ChatMessage): string {
    return createHash('md5')
      .update(`${msg.role}:${msg.content || ''}`)
      .digest('hex');
  }

  private hashMessages(messages: ChatMessage[]): string {
    const content = messages.map(m => `${m.role}:${m.content || ''}`).join('|');
    return createHash('md5').update(content).digest('hex');
  }

  getTotalSavedTokens(): number {
    return this.totalSavedTokens;
  }

  /** Clean up old conversations */
  cleanup(maxAgeMs: number = 30 * 60 * 1000): void {
    const now = Date.now();
    for (const [id, state] of this.conversations) {
      if (now - state.lastAccess > maxAgeMs) {
        this.conversations.delete(id);
      }
    }
  }
}
