import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { SharedStateStore } from './shared-state-store';

describe('SharedStateStore', () => {
  it('stores and retrieves a value', () => {
    const store = new SharedStateStore();
    store.set('ctx1', 'Hello world', 'agent-a');
    assert.equal(store.get('ctx1'), 'Hello world');
  });

  it('detects duplicate values', () => {
    const store = new SharedStateStore();
    const r1 = store.set('ctx1', 'Same content');
    const r2 = store.set('ctx1', 'Same content');
    assert.equal(r1.isDuplicate, false);
    assert.equal(r2.isDuplicate, true);
  });

  it('overwrites when content changes', () => {
    const store = new SharedStateStore();
    store.set('ctx1', 'Version 1');
    store.set('ctx1', 'Version 2');
    assert.equal(store.get('ctx1'), 'Version 2');
  });

  it('returns undefined for missing keys', () => {
    const store = new SharedStateStore();
    assert.equal(store.get('nonexistent'), undefined);
  });

  it('checks existence with has()', () => {
    const store = new SharedStateStore();
    store.set('k', 'v');
    assert.equal(store.has('k'), true);
    assert.equal(store.has('missing'), false);
  });

  it('generates refs', () => {
    const store = new SharedStateStore();
    store.set('ctx1', 'Hello');
    const ref = store.getRef('ctx1');
    assert.ok(ref);
    assert.ok(ref!.startsWith('[shared-context:ctx1:'));
  });

  it('returns undefined ref for missing key', () => {
    const store = new SharedStateStore();
    assert.equal(store.getRef('missing'), undefined);
  });

  it('deletes entries', () => {
    const store = new SharedStateStore();
    store.set('k', 'v');
    assert.equal(store.delete('k'), true);
    assert.equal(store.get('k'), undefined);
  });

  it('lists all entries', () => {
    const store = new SharedStateStore();
    store.set('a', 'val-a', 'agent-1');
    store.set('b', 'val-b', 'agent-2');
    const list = store.list();
    assert.equal(list.length, 2);
    assert.ok(list.some(e => e.key === 'a' && e.agentId === 'agent-1'));
  });

  it('evicts LRU when over maxEntries', () => {
    const store = new SharedStateStore({ maxEntries: 2 });
    store.set('a', 'val-a');
    store.set('b', 'val-b');
    store.get('a'); // access a to make it recent
    store.set('c', 'val-c'); // should evict b
    assert.equal(store.has('a'), true);
    assert.equal(store.has('b'), false);
    assert.equal(store.has('c'), true);
  });

  it('expires entries based on TTL', () => {
    const store = new SharedStateStore({ ttlMs: 1 });
    store.set('k', 'v');
    // Force expiry by waiting (entry created with ttlMs=1ms)
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }
    assert.equal(store.get('k'), undefined);
  });

  it('tracks stats', () => {
    const store = new SharedStateStore();
    store.set('a', 'Hello world');
    const stats = store.getStats();
    assert.equal(stats.entries, 1);
    assert.ok(stats.totalTokensStored > 0);
  });

  it('clears all entries', () => {
    const store = new SharedStateStore();
    store.set('a', 'v');
    store.set('b', 'v');
    store.clear();
    assert.equal(store.getStats().entries, 0);
  });
});
