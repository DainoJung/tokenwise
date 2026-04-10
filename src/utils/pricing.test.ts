import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { estimateCost, getModelTier, MODEL_PRICING } from './pricing';

describe('estimateCost', () => {
  it('calculates cost for known model', () => {
    // gpt-4o: input $2.50/1M, output $10.00/1M
    const cost = estimateCost('gpt-4o', 1_000_000, 1_000_000);
    assert.equal(cost, 2.50 + 10.00);
  });

  it('calculates cost with cached input tokens', () => {
    // gpt-4o: cachedInput $1.25/1M
    const cost = estimateCost('gpt-4o', 1_000_000, 0, 500_000);
    // 500K regular * 2.50/1M + 500K cached * 1.25/1M
    assert.equal(cost, 1.25 + 0.625);
  });

  it('uses gpt-4o fallback for unknown model', () => {
    const cost = estimateCost('unknown-model', 1_000_000, 1_000_000);
    const expected = (1_000_000 * 2.50) / 1_000_000 + (1_000_000 * 10.00) / 1_000_000;
    assert.equal(cost, expected);
  });

  it('returns 0 for zero tokens', () => {
    const cost = estimateCost('gpt-4o', 0, 0);
    assert.equal(cost, 0);
  });

  it('calculates nano model correctly', () => {
    // gpt-4.1-nano: input $0.10/1M, output $0.40/1M
    const cost = estimateCost('gpt-4.1-nano', 100_000, 50_000);
    const expected = (100_000 * 0.10) / 1_000_000 + (50_000 * 0.40) / 1_000_000;
    assert.ok(Math.abs(cost - expected) < 0.0001);
  });
});

describe('getModelTier', () => {
  it('returns cheap for nano models', () => {
    assert.equal(getModelTier('gpt-4.1-nano'), 'cheap');
  });

  it('returns mid for gpt-4o', () => {
    assert.equal(getModelTier('gpt-4o'), 'mid');
  });

  it('returns expensive for o3', () => {
    assert.equal(getModelTier('o3'), 'expensive');
  });

  it('returns expensive for claude-opus', () => {
    assert.equal(getModelTier('claude-opus-4-6'), 'expensive');
  });

  it('returns mid for unknown model', () => {
    assert.equal(getModelTier('unknown'), 'mid');
  });
});

describe('MODEL_PRICING', () => {
  it('has pricing for all major models', () => {
    const expectedModels = ['gpt-4o', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3', 'claude-sonnet-4-6'];
    for (const model of expectedModels) {
      assert.ok(MODEL_PRICING[model], `Missing pricing for ${model}`);
      assert.ok(MODEL_PRICING[model].input > 0);
      assert.ok(MODEL_PRICING[model].output > 0);
    }
  });
});
