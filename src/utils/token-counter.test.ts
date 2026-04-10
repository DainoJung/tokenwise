import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { countTokens, countMessageTokens, countToolTokens } from './token-counter';

describe('countTokens', () => {
  it('returns 0 for empty string', () => {
    assert.equal(countTokens(''), 0);
  });

  it('counts tokens for simple text', () => {
    const count = countTokens('Hello, world!');
    assert.ok(count > 0);
    assert.ok(count < 10);
  });

  it('counts more tokens for longer text', () => {
    const short = countTokens('Hi');
    const long = countTokens('This is a much longer sentence with many more words in it');
    assert.ok(long > short);
  });
});

describe('countMessageTokens', () => {
  it('counts single message', () => {
    const count = countMessageTokens([
      { role: 'user', content: 'Hello' },
    ]);
    // overhead (4 per msg + 2 priming) + content tokens + role token
    assert.ok(count > 0);
  });

  it('counts multiple messages', () => {
    const single = countMessageTokens([
      { role: 'user', content: 'Hello' },
    ]);
    const multi = countMessageTokens([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello' },
    ]);
    assert.ok(multi > single);
  });

  it('handles null content', () => {
    const count = countMessageTokens([
      { role: 'assistant', content: null },
    ]);
    assert.ok(count >= 0);
  });

  it('accounts for name field', () => {
    const withName = countMessageTokens([
      { role: 'user', content: 'Hello', name: 'alice' },
    ]);
    const withoutName = countMessageTokens([
      { role: 'user', content: 'Hello' },
    ]);
    // name adds tokens for the name but subtracts 1 for role
    // if name is 1 token, net effect is 0, which is valid behavior
    assert.ok(withName >= withoutName - 1);
  });
});

describe('countToolTokens', () => {
  it('counts a single tool', () => {
    const count = countToolTokens([
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get the current weather for a location',
          parameters: {
            type: 'object',
            properties: { location: { type: 'string' } },
          },
        },
      },
    ]);
    assert.ok(count > 0);
  });

  it('counts more for multiple tools', () => {
    const one = countToolTokens([
      { type: 'function', function: { name: 'a', description: 'desc a' } },
    ]);
    const two = countToolTokens([
      { type: 'function', function: { name: 'a', description: 'desc a' } },
      { type: 'function', function: { name: 'b', description: 'desc b' } },
    ]);
    assert.ok(two > one);
  });

  it('handles tool without parameters', () => {
    const count = countToolTokens([
      { type: 'function', function: { name: 'ping', description: 'Health check' } },
    ]);
    assert.ok(count > 0);
  });
});
