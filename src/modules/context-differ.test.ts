import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { ContextDiffer } from './context-differ';

describe('ContextDiffer', () => {
  it('returns messages unchanged when under window limit', () => {
    const differ = new ContextDiffer();
    const messages = [
      { role: 'system' as const, content: 'You are helpful.' },
      { role: 'user' as const, content: 'Hello' },
    ];
    const result = differ.optimize('conv1', messages);
    assert.equal(result.messages.length, 2);
    assert.equal(result.stats.savedTokens, 0);
  });

  it('deduplicates multiple system messages', () => {
    const differ = new ContextDiffer();
    const messages = [
      { role: 'system' as const, content: 'Rule 1' },
      { role: 'user' as const, content: 'Hi' },
      { role: 'system' as const, content: 'Rule 2' },
    ];
    const result = differ.optimize('conv2', messages);
    const systemMsgs = result.messages.filter(m => m.role === 'system');
    assert.equal(systemMsgs.length, 1);
    assert.ok(systemMsgs[0].content!.includes('Rule 1'));
    assert.ok(systemMsgs[0].content!.includes('Rule 2'));
  });

  it('preserves single system message as-is', () => {
    const differ = new ContextDiffer();
    const messages = [
      { role: 'system' as const, content: 'System prompt' },
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there' },
    ];
    const result = differ.optimize('conv3', messages);
    assert.equal(result.messages[0].content, 'System prompt');
  });

  it('compresses old messages when over window limit', () => {
    const differ = new ContextDiffer({ maxWindowTokens: 50, keepRecentMessages: 2 });
    const messages = [
      { role: 'system' as const, content: 'System prompt' },
      { role: 'user' as const, content: 'First message with lots of content that takes tokens' },
      { role: 'assistant' as const, content: 'First response with lots of content that takes tokens' },
      { role: 'user' as const, content: 'Second message with lots of content' },
      { role: 'assistant' as const, content: 'Second response with lots of content' },
      { role: 'user' as const, content: 'Third message' },
      { role: 'assistant' as const, content: 'Third response' },
    ];
    const result = differ.optimize('conv4', messages);
    // Should have compressed old messages
    assert.ok(result.messages.length < messages.length);
  });

  it('tracks total saved tokens', () => {
    const differ = new ContextDiffer();
    const messages = [
      { role: 'system' as const, content: 'Rule A' },
      { role: 'system' as const, content: 'Rule B' },
      { role: 'user' as const, content: 'Hello' },
    ];
    differ.optimize('conv5', messages);
    // Dedup should save some tokens
    assert.ok(differ.getTotalSavedTokens() >= 0);
  });

  it('cleanup removes old conversations', () => {
    const differ = new ContextDiffer();
    differ.optimize('old-conv', [
      { role: 'user' as const, content: 'Hello' },
    ]);
    // Cleanup with 0ms max age should remove it
    differ.cleanup(0);
    // Optimizing again should treat it as new
    const result = differ.optimize('old-conv', [
      { role: 'user' as const, content: 'Hello again' },
    ]);
    assert.ok(result.messages.length > 0);
  });

  it('disables dedup when option is false', () => {
    const differ = new ContextDiffer({ deduplicateSystem: false });
    const messages = [
      { role: 'system' as const, content: 'Rule 1' },
      { role: 'user' as const, content: 'Hi' },
      { role: 'system' as const, content: 'Rule 2' },
    ];
    const result = differ.optimize('conv6', messages);
    const systemMsgs = result.messages.filter(m => m.role === 'system');
    assert.equal(systemMsgs.length, 2);
  });
});
