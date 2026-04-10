import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { ModelRouter } from './model-router';
import type { ChatMessage, CompressedTool } from '../types';

function msg(role: ChatMessage['role'], content: string): ChatMessage {
  return { role, content };
}

function makeTools(n: number): CompressedTool[] {
  return Array.from({ length: n }, (_, i) => ({
    type: 'function' as const,
    function: { name: `tool_${i}`, description: `Tool ${i} description` },
  }));
}

describe('ModelRouter', () => {
  describe('simple request routing', () => {
    it('routes simple gpt-4o request to nano', () => {
      const router = new ModelRouter();
      const result = router.route('gpt-4o', [msg('user', 'Hi')]);
      assert.equal(result.model, 'gpt-4.1-nano');
      assert.equal(result.wasRouted, true);
      assert.equal(result.complexity.level, 'simple');
    });

    it('routes simple claude-opus to haiku', () => {
      const router = new ModelRouter();
      const result = router.route('claude-opus-4-6', [msg('user', 'Hello')]);
      assert.equal(result.model, 'claude-haiku-4-5');
      assert.equal(result.wasRouted, true);
    });
  });

  describe('complex request detection', () => {
    it('keeps gpt-4o for complex reasoning tasks', () => {
      const router = new ModelRouter();
      const result = router.route('gpt-4o', [
        msg('system', 'You are an architect.'),
        msg('user', 'Analyze and compare the trade-offs between microservices and monolith architecture, then design a plan considering scalability, performance, and security.'),
      ], makeTools(15));
      assert.equal(result.complexity.level, 'complex');
      assert.equal(result.model, 'gpt-4o');
      assert.equal(result.wasRouted, false);
    });

    it('detects multi-step requests as complex', () => {
      const router = new ModelRouter();
      const result = router.route('gpt-4o', [
        msg('user', 'First read the file, then analyze the code, after that refactor the function, and finally write tests.'),
      ]);
      assert.ok(result.complexity.score > 15);
      assert.ok(result.complexity.reasons.includes('multi-step-request'));
    });
  });

  describe('moderate routing', () => {
    it('routes moderate gpt-4o to mini', () => {
      const router = new ModelRouter();
      // code-generation (+10) + some-tools (+10) + medium-message (+5) = 25 → moderate
      const result = router.route('gpt-4o', [
        msg('user', 'Write a function that validates email addresses and handles edge cases properly for our authentication system'),
      ], makeTools(5));
      assert.equal(result.complexity.level, 'moderate');
      assert.equal(result.model, 'gpt-4.1-mini');
    });
  });

  describe('skip models', () => {
    it('skips already-cheap models', () => {
      const router = new ModelRouter();
      const result = router.route('gpt-4.1-nano', [
        msg('user', 'Analyze complex system architecture with many considerations.'),
      ]);
      assert.equal(result.model, 'gpt-4.1-nano');
      assert.equal(result.wasRouted, false);
    });
  });

  describe('unknown models', () => {
    it('passes through unknown models unchanged', () => {
      const router = new ModelRouter();
      const result = router.route('custom-model-v1', [msg('user', 'Hello')]);
      assert.equal(result.model, 'custom-model-v1');
      assert.equal(result.wasRouted, false);
    });
  });

  describe('routing history', () => {
    it('tracks routing decisions', () => {
      const router = new ModelRouter();
      router.route('gpt-4o', [msg('user', 'Hi')]);
      router.route('gpt-4o', [msg('user', 'Bye')]);
      const history = router.getRoutingHistory();
      assert.equal(history.length, 2);
    });

    it('provides routing summary', () => {
      const router = new ModelRouter();
      router.route('gpt-4o', [msg('user', 'Hi')]);
      const summary = router.getRoutingSummary();
      assert.equal(summary.totalRouted, 1);
      assert.equal(summary.downgraded, 1);
      assert.ok(summary.byComplexity.simple >= 1);
    });
  });

  describe('allowed models whitelist', () => {
    it('respects allowed models', () => {
      const router = new ModelRouter({ allowedModels: ['gpt-4o', 'gpt-4.1-mini'] });
      const result = router.route('gpt-4o', [msg('user', 'Hi')]);
      // nano is not in allowed list, so should not route to it
      assert.notEqual(result.model, 'gpt-4.1-nano');
    });
  });
});
