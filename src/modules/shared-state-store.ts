/**
 * Shared State Store — Cross-agent context sharing
 *
 * Problem: In multi-agent systems, each agent maintains its own context,
 * leading to massive redundancy when agents share information.
 *
 * Solution: A shared store where agents can read/write context fragments,
 * avoiding resending identical context across agents.
 */

import { createHash } from 'crypto';
import { countTokens } from '../utils/token-counter';

export interface SharedStateStoreOptions {
  /** Max entries in the store (default: 1000) */
  maxEntries?: number;
  /** TTL for entries in ms (default: 30 minutes) */
  ttlMs?: number;
}

interface StateEntry {
  key: string;
  value: string;
  hash: string;
  tokens: number;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  agentId: string;
}

const DEFAULT_OPTIONS: Required<SharedStateStoreOptions> = {
  maxEntries: 1000,
  ttlMs: 30 * 60 * 1000,
};

export class SharedStateStore {
  private entries = new Map<string, StateEntry>();
  private options: Required<SharedStateStoreOptions>;
  private totalTokensSaved = 0;

  constructor(options: SharedStateStoreOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Store a context fragment that can be shared across agents
   */
  set(key: string, value: string, agentId: string = 'default'): { hash: string; tokens: number; isDuplicate: boolean } {
    const hash = createHash('md5').update(value).digest('hex');
    const existing = this.entries.get(key);

    if (existing && existing.hash === hash) {
      existing.lastAccessedAt = Date.now();
      existing.accessCount++;
      this.totalTokensSaved += existing.tokens;
      return { hash, tokens: existing.tokens, isDuplicate: true };
    }

    const tokens = countTokens(value);
    this.entries.set(key, {
      key,
      value,
      hash,
      tokens,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 1,
      agentId,
    });

    this.evictIfNeeded();
    return { hash, tokens, isDuplicate: false };
  }

  /**
   * Get a stored context fragment
   */
  get(key: string): string | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.createdAt > this.options.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }

    entry.lastAccessedAt = Date.now();
    entry.accessCount++;
    // Re-set to update map ordering for LRU
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  /**
   * Check if a value already exists (by content hash) without retrieving it
   */
  has(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (Date.now() - entry.createdAt > this.options.ttlMs) {
      this.entries.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get a reference token instead of full content (saves tokens in messages)
   */
  getRef(key: string): string | undefined {
    if (!this.has(key)) return undefined;
    const entry = this.entries.get(key)!;
    return `[shared-context:${key}:${entry.hash.substring(0, 8)}]`;
  }

  /**
   * Remove an entry
   */
  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  /**
   * List all keys with metadata
   */
  list(): Array<{ key: string; tokens: number; agentId: string; accessCount: number }> {
    this.cleanExpired();
    return Array.from(this.entries.values()).map(e => ({
      key: e.key,
      tokens: e.tokens,
      agentId: e.agentId,
      accessCount: e.accessCount,
    }));
  }

  getTotalTokensSaved(): number {
    return this.totalTokensSaved;
  }

  getStats() {
    return {
      entries: this.entries.size,
      totalTokensStored: Array.from(this.entries.values()).reduce((sum, e) => sum + e.tokens, 0),
      totalTokensSaved: this.totalTokensSaved,
    };
  }

  private evictIfNeeded(): void {
    if (this.entries.size <= this.options.maxEntries) return;

    // Evict least recently accessed entries
    const sorted = Array.from(this.entries.entries())
      .sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);

    const toRemove = sorted.slice(0, this.entries.size - this.options.maxEntries);
    for (const [key] of toRemove) {
      this.entries.delete(key);
    }
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now - entry.createdAt > this.options.ttlMs) {
        this.entries.delete(key);
      }
    }
  }

  clear(): void {
    this.entries.clear();
  }
}
