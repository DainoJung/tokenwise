import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { CostTracker } from './cost-tracker';

describe('CostTracker', () => {
  it('records a cost entry', () => {
    const tracker = new CostTracker();
    const record = tracker.record({
      model: 'gpt-4.1-nano',
      originalModel: 'gpt-4o',
      inputTokens: 500,
      outputTokens: 100,
      originalInputTokens: 1000,
      optimizations: ['model-router', 'context-differ'],
    });
    assert.ok(record.timestamp > 0);
    assert.equal(record.model, 'gpt-4.1-nano');
    assert.equal(record.savedInputTokens, 500);
    assert.ok(record.savingsUSD > 0);
  });

  it('computes summary across multiple records', () => {
    const tracker = new CostTracker();
    tracker.record({
      model: 'gpt-4.1-nano',
      originalModel: 'gpt-4o',
      inputTokens: 500,
      outputTokens: 100,
      originalInputTokens: 1000,
      optimizations: [],
    });
    tracker.record({
      model: 'gpt-4.1-mini',
      originalModel: 'gpt-4o',
      inputTokens: 800,
      outputTokens: 200,
      originalInputTokens: 1500,
      optimizations: [],
    });
    const summary = tracker.getSummary();
    assert.equal(summary.totalRequests, 2);
    assert.equal(summary.totalInputTokens, 1300);
    assert.equal(summary.totalOutputTokens, 300);
    assert.equal(summary.totalOriginalInputTokens, 2500);
    assert.ok(summary.savingsPercent > 0);
    assert.ok(summary.byModel['gpt-4.1-nano']);
    assert.ok(summary.byModel['gpt-4.1-mini']);
  });

  it('returns 0% savings with no records', () => {
    const tracker = new CostTracker();
    const summary = tracker.getSummary();
    assert.equal(summary.totalRequests, 0);
    assert.equal(summary.savingsPercent, 0);
  });

  it('handles negative saved tokens gracefully', () => {
    const tracker = new CostTracker();
    const record = tracker.record({
      model: 'gpt-4o',
      originalModel: 'gpt-4o',
      inputTokens: 1500,
      outputTokens: 100,
      originalInputTokens: 1000,
      optimizations: [],
    });
    assert.equal(record.savedInputTokens, 0);
    assert.equal(record.savingsUSD, 0);
  });

  it('prints a formatted summary', () => {
    const tracker = new CostTracker();
    tracker.record({
      model: 'gpt-4.1-nano',
      originalModel: 'gpt-4o',
      inputTokens: 500,
      outputTokens: 100,
      originalInputTokens: 2000,
      optimizations: ['model-router'],
    });
    const output = tracker.printSummary();
    assert.ok(output.includes('TokenWise Cost Report'));
    assert.ok(output.includes('Requests:'));
    assert.ok(output.includes('Savings:'));
  });

  it('resets all records', () => {
    const tracker = new CostTracker();
    tracker.record({
      model: 'gpt-4o',
      originalModel: 'gpt-4o',
      inputTokens: 100,
      outputTokens: 50,
      originalInputTokens: 100,
      optimizations: [],
    });
    tracker.reset();
    assert.equal(tracker.getSummary().totalRequests, 0);
  });

  it('groups by model correctly', () => {
    const tracker = new CostTracker();
    tracker.record({ model: 'gpt-4.1-nano', originalModel: 'gpt-4o', inputTokens: 100, outputTokens: 50, originalInputTokens: 200, optimizations: [] });
    tracker.record({ model: 'gpt-4.1-nano', originalModel: 'gpt-4o', inputTokens: 150, outputTokens: 60, originalInputTokens: 300, optimizations: [] });
    tracker.record({ model: 'gpt-4.1-mini', originalModel: 'gpt-4o', inputTokens: 200, outputTokens: 70, originalInputTokens: 400, optimizations: [] });
    const summary = tracker.getSummary();
    assert.equal(summary.byModel['gpt-4.1-nano'].requests, 2);
    assert.equal(summary.byModel['gpt-4.1-mini'].requests, 1);
  });
});
