/**
 * TokenWise — Core Types
 */

export interface TokenWiseConfig {
  /** OpenAI API key */
  apiKey: string;
  /** Base URL for OpenAI API (default: https://api.openai.com/v1) */
  baseURL?: string;
  /** Enable context diffing (default: true) */
  contextDiffer?: boolean;
  /** Enable skill/tool compression (default: true) */
  skillCompressor?: boolean;
  /** Enable model routing (default: true) */
  modelRouter?: boolean;
  /** Model routing rules */
  routingRules?: RoutingRule[];
  /** Cost tracking (default: true) */
  trackCosts?: boolean;
  /** Verbose logging (default: false) */
  verbose?: boolean;
}

export interface RoutingRule {
  /** Condition to match */
  condition: 'simple' | 'moderate' | 'complex';
  /** Model to use when condition matches */
  model: string;
  /** Max tokens threshold for complexity classification */
  maxInputTokens?: number;
  /** Max tools count threshold */
  maxTools?: number;
}

export interface TokenStats {
  /** Original token count (before optimization) */
  originalTokens: number;
  /** Optimized token count (after optimization) */
  optimizedTokens: number;
  /** Tokens saved */
  savedTokens: number;
  /** Savings percentage */
  savingsPercent: number;
  /** Which optimizations were applied */
  appliedOptimizations: string[];
}

export interface CostRecord {
  timestamp: number;
  model: string;
  originalModel: string;
  inputTokens: number;
  outputTokens: number;
  originalInputTokens: number;
  savedInputTokens: number;
  estimatedCostUSD: number;
  estimatedOriginalCostUSD: number;
  savingsUSD: number;
  optimizations: string[];
}

export interface CostSummary {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalOriginalInputTokens: number;
  totalSavedInputTokens: number;
  totalCostUSD: number;
  totalOriginalCostUSD: number;
  totalSavingsUSD: number;
  savingsPercent: number;
  byModel: Record<string, {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    costUSD: number;
  }>;
  records: CostRecord[];
}

export interface CompressedTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
  };
}

/** Context diff entry for incremental context updates */
export interface ContextDiff {
  /** Conversation ID for tracking */
  conversationId: string;
  /** Hash of previous messages array */
  previousHash: string;
  /** Only the new/changed messages */
  delta: ChatMessage[];
  /** Index from which messages changed */
  changeIndex: number;
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
};

/** Model pricing per 1M tokens in USD */
export interface ModelPricing {
  input: number;
  output: number;
  cachedInput?: number;
}
