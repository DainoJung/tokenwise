/**
 * Model pricing data (per 1M tokens, USD)
 * Source: OpenAI pricing page, updated 2025-Q2
 */

import type { ModelPricing } from '../types';

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // GPT-4o family
  'gpt-4o': { input: 2.50, output: 10.00, cachedInput: 1.25 },
  'gpt-4o-2024-11-20': { input: 2.50, output: 10.00, cachedInput: 1.25 },
  'gpt-4o-mini': { input: 0.15, output: 0.60, cachedInput: 0.075 },
  'gpt-4o-mini-2024-07-18': { input: 0.15, output: 0.60, cachedInput: 0.075 },

  // GPT-4.1 family
  'gpt-4.1': { input: 2.00, output: 8.00, cachedInput: 0.50 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60, cachedInput: 0.10 },
  'gpt-4.1-nano': { input: 0.10, output: 0.40, cachedInput: 0.025 },

  // GPT-5 family
  'gpt-5': { input: 5.00, output: 15.00, cachedInput: 2.50 },
  'gpt-5-mini': { input: 0.50, output: 2.00, cachedInput: 0.25 },

  // o-series (reasoning)
  'o4-mini': { input: 1.10, output: 4.40, cachedInput: 0.275 },
  'o3': { input: 10.00, output: 40.00, cachedInput: 2.50 },
  'o3-mini': { input: 1.10, output: 4.40, cachedInput: 0.275 },

  // Claude (for future multi-provider support)
  'claude-sonnet-4-6': { input: 3.00, output: 15.00, cachedInput: 0.30 },
  'claude-opus-4-6': { input: 15.00, output: 75.00, cachedInput: 1.50 },
  'claude-haiku-4-5': { input: 0.80, output: 4.00, cachedInput: 0.08 },
};

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number = 0
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    // Fallback: assume gpt-4o pricing
    const fallback = MODEL_PRICING['gpt-4o']!;
    return (
      (inputTokens * fallback.input) / 1_000_000 +
      (outputTokens * fallback.output) / 1_000_000
    );
  }

  const regularInput = inputTokens - cachedInputTokens;
  const inputCost = (regularInput * pricing.input) / 1_000_000;
  const cachedCost = pricing.cachedInput
    ? (cachedInputTokens * pricing.cachedInput) / 1_000_000
    : 0;
  const outputCost = (outputTokens * pricing.output) / 1_000_000;

  return inputCost + cachedCost + outputCost;
}

export function getModelTier(model: string): 'cheap' | 'mid' | 'expensive' {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 'mid';
  if (pricing.input <= 0.5) return 'cheap';
  if (pricing.input <= 3.0) return 'mid';
  return 'expensive';
}
