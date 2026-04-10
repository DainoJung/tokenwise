import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { SmartWakeGate } from './smart-wake-gate';
import type { AgentProfile } from './smart-wake-gate';

function makeAgent(id: string, keywords: string[], tools: string[] = []): AgentProfile {
  return { id, name: `Agent ${id}`, triggerKeywords: keywords, toolNames: tools, systemPromptTokens: 500 };
}

describe('SmartWakeGate', () => {
  it('wakes relevant agents', () => {
    const gate = new SmartWakeGate();
    gate.register(makeAgent('search', ['search', 'find', 'look up']));
    gate.register(makeAgent('calc', ['calculate', 'math', 'compute']));
    gate.register(makeAgent('code', ['code', 'program', 'function']));

    const awake = gate.evaluate('search for the latest news');
    assert.ok(awake.includes('search'));
    assert.ok(!awake.includes('calc'));
  });

  it('suppresses irrelevant agents', () => {
    const gate = new SmartWakeGate();
    gate.register(makeAgent('a', ['alpha']));
    gate.register(makeAgent('b', ['beta']));
    gate.register(makeAgent('c', ['gamma']));

    const awake = gate.evaluate('tell me about alpha');
    assert.equal(awake.length, 1);
    assert.equal(awake[0], 'a');
  });

  it('respects maxAwake limit', () => {
    const gate = new SmartWakeGate({ maxAwake: 2 });
    gate.register(makeAgent('a', ['test']));
    gate.register(makeAgent('b', ['test']));
    gate.register(makeAgent('c', ['test']));

    const awake = gate.evaluate('run test');
    assert.ok(awake.length <= 2);
  });

  it('respects wakeThreshold', () => {
    const gate = new SmartWakeGate({ wakeThreshold: 0.9 });
    gate.register(makeAgent('a', ['specific', 'unique', 'rare', 'unusual']));

    const awake = gate.evaluate('something general');
    assert.equal(awake.length, 0);
  });

  it('tracks stats', () => {
    const gate = new SmartWakeGate();
    gate.register(makeAgent('a', ['hello']));
    gate.register(makeAgent('b', ['world']));

    gate.evaluate('hello there');
    const stats = gate.getStats();
    assert.equal(stats.registered, 2);
    assert.ok(stats.totalWakes >= 1);
    assert.ok(stats.totalSuppressed >= 1);
  });

  it('returns awake agents list', () => {
    const gate = new SmartWakeGate();
    gate.register(makeAgent('a', ['test']));
    gate.evaluate('run test');
    assert.ok(gate.getAwakeAgents().includes('a'));
  });

  it('considers tool name matching', () => {
    const gate = new SmartWakeGate();
    gate.register(makeAgent('db', ['database'], ['query_database', 'insert_record']));
    gate.register(makeAgent('web', ['web'], ['fetch_url', 'scrape_page']));

    const awake = gate.evaluate('query the database', ['query_database']);
    assert.ok(awake.includes('db'));
  });

  it('tracks total tokens saved', () => {
    const gate = new SmartWakeGate();
    gate.register(makeAgent('a', ['alpha'], [], ));
    gate.register(makeAgent('b', ['beta']));
    gate.evaluate('alpha task');
    assert.ok(gate.getStats().totalTokensSaved >= 0);
  });
});
