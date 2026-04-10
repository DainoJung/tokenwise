import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { OutputCompactor } from './output-compactor';

describe('OutputCompactor', () => {
  describe('filler removal', () => {
    it('removes common LLM filler phrases', () => {
      const compactor = new OutputCompactor({ stripMarkdown: false, compactJSON: false });
      const input = "Certainly! I'd be happy to help. Here's the answer: The result is 42.";
      const result = compactor.compact(input);
      assert.ok(!result.text.includes('Certainly'));
      assert.ok(!result.text.includes("I'd be happy to help"));
      assert.ok(result.text.includes('42'));
    });

    it('removes closing filler', () => {
      const compactor = new OutputCompactor({ stripMarkdown: false, compactJSON: false });
      const input = 'The answer is 42. I hope this helps! Let me know if you need anything else.';
      const result = compactor.compact(input);
      assert.ok(result.text.includes('42'));
      assert.ok(!result.text.includes('I hope this helps'));
    });
  });

  describe('markdown stripping', () => {
    it('removes markdown headers', () => {
      const compactor = new OutputCompactor({ removeFiller: false, compactJSON: false });
      const input = '## Title\n\nSome content\n\n### Subtitle\n\nMore content';
      const result = compactor.compact(input);
      assert.ok(!result.text.includes('##'));
      assert.ok(result.text.includes('Title'));
      assert.ok(result.text.includes('Some content'));
    });

    it('removes bold/italic markers', () => {
      const compactor = new OutputCompactor({ removeFiller: false, compactJSON: false });
      const input = 'This is **bold** and *italic* text';
      const result = compactor.compact(input);
      assert.ok(!result.text.includes('**'));
      assert.ok(!result.text.includes('*'));
      assert.ok(result.text.includes('bold'));
      assert.ok(result.text.includes('italic'));
    });

    it('removes inline code backticks', () => {
      const compactor = new OutputCompactor({ removeFiller: false, compactJSON: false });
      const input = 'Use the `forEach` method';
      const result = compactor.compact(input);
      assert.ok(!result.text.includes('`'));
      assert.ok(result.text.includes('forEach'));
    });
  });

  describe('JSON compaction', () => {
    it('minifies JSON blocks', () => {
      const compactor = new OutputCompactor({ removeFiller: false, stripMarkdown: false });
      const input = '```json\n{\n  "name": "test",\n  "value": 42\n}\n```';
      const result = compactor.compact(input);
      assert.ok(result.text.includes('{"name":"test","value":42}'));
    });

    it('handles invalid JSON gracefully', () => {
      const compactor = new OutputCompactor({ removeFiller: false, stripMarkdown: false });
      const input = '```json\n{invalid json}\n```';
      const result = compactor.compact(input);
      assert.ok(result.text.includes('{invalid json}'));
    });
  });

  describe('truncation', () => {
    it('truncates to max tokens', () => {
      const compactor = new OutputCompactor({
        removeFiller: false,
        stripMarkdown: false,
        compactJSON: false,
        maxOutputTokens: 5,
      });
      const input = 'This is a very long sentence that should be truncated to fit within the token limit specified by the configuration option.';
      const result = compactor.compact(input);
      assert.ok(result.stats.compactedTokens <= 6); // allow small margin
      assert.ok(result.text.endsWith('...'));
    });

    it('does not truncate when under limit', () => {
      const compactor = new OutputCompactor({
        removeFiller: false,
        stripMarkdown: false,
        compactJSON: false,
        maxOutputTokens: 1000,
      });
      const input = 'Short text';
      const result = compactor.compact(input);
      assert.equal(result.text, 'Short text');
    });
  });

  describe('stats tracking', () => {
    it('reports saved tokens', () => {
      const compactor = new OutputCompactor();
      const result = compactor.compact("Certainly! I'd be happy to help. ## Answer\n\nThe result is **42**.");
      assert.ok(result.stats.savedTokens >= 0);
      assert.ok(result.stats.originalTokens > 0);
    });

    it('tracks cumulative savings', () => {
      const compactor = new OutputCompactor();
      compactor.compact("Certainly! The answer is 42.");
      compactor.compact("Of course! Here's the result: 100.");
      assert.ok(compactor.getTotalSavedTokens() >= 0);
    });
  });

  describe('options', () => {
    it('can disable all optimizations', () => {
      const compactor = new OutputCompactor({
        removeFiller: false,
        stripMarkdown: false,
        compactJSON: false,
      });
      const input = 'Certainly! **Bold** text';
      const result = compactor.compact(input);
      assert.ok(result.text.includes('Certainly'));
      assert.ok(result.text.includes('**'));
    });
  });
});
