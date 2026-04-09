/**
 * TokenWise — Spend less, agent more.
 * Token optimization SDK for Agentic AI.
 *
 * @example SDK mode (recommended)
 * ```ts
 * import { TokenWise } from 'tokenwise';
 *
 * const tw = new TokenWise({ apiKey: process.env.OPENAI_API_KEY });
 * const res = await tw.chat.completions.create({
 *   model: 'gpt-4o',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 *
 * console.log(res.choices[0].message);
 * console.log(tw.printSavings());
 * ```
 *
 * @example Proxy mode (zero code change)
 * ```bash
 * npx tokenwise proxy --port 8787
 * ```
 * Then set `base_url` to `http://localhost:8787/v1` in your existing code.
 */

// Main client
export { TokenWise } from './client';

// Individual modules (for advanced usage)
export { ContextDiffer } from './modules/context-differ';
export type { ContextDifferOptions } from './modules/context-differ';

export { SkillCompressor } from './modules/skill-compressor';
export type { SkillCompressorOptions } from './modules/skill-compressor';

export { ModelRouter } from './modules/model-router';
export type { ModelRouterOptions } from './modules/model-router';

export { CostTracker } from './modules/cost-tracker';

// Proxy server
export { createProxyServer } from './proxy/server';
export type { ProxyServerOptions } from './proxy/server';

// Utilities
export { countTokens, countMessageTokens, countToolTokens } from './utils/token-counter';
export { estimateCost, MODEL_PRICING, getModelTier } from './utils/pricing';

// Types
export type {
  TokenWiseConfig,
  RoutingRule,
  TokenStats,
  CostRecord,
  CostSummary,
  CompressedTool,
  ChatMessage,
  ModelPricing,
} from './types';
