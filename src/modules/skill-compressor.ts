/**
 * Skill Compressor — Reduce token cost of tool/function definitions
 *
 * Problem: Agentic systems register 10-50+ tools. Each tool description
 * can be 200-500 tokens. With 30 tools, that's 6K-15K tokens per call,
 * and most tools are irrelevant to the current task.
 *
 * Solution:
 * 1. Compress descriptions (remove filler words, abbreviate)
 * 2. Filter tools by relevance to current message
 * 3. Minify JSON schemas
 *
 * Based on SkillReducer research: 48% description + 39% body compression achievable.
 */

import type { CompressedTool } from '../types';
import { countTokens, countToolTokens } from '../utils/token-counter';

export interface SkillCompressorOptions {
  /** Enable description compression (default: true) */
  compressDescriptions?: boolean;
  /** Enable relevance filtering (default: true) */
  filterByRelevance?: boolean;
  /** Max tools to include when filtering (default: 15) */
  maxTools?: number;
  /** Enable JSON schema minification (default: true) */
  minifySchemas?: boolean;
}

const DEFAULT_OPTIONS: Required<SkillCompressorOptions> = {
  compressDescriptions: true,
  filterByRelevance: true,
  maxTools: 15,
  minifySchemas: true,
};

// Filler words and phrases that can be safely removed from descriptions
const FILLER_PATTERNS: RegExp[] = [
  /\bThis (?:function|tool|method|endpoint|API) (?:is used to |allows you to |can be used to |will |helps to |enables you to )/gi,
  /\bUse this (?:function|tool|method) to /gi,
  /\bThis is a (?:function|tool|method) (?:that|which) /gi,
  /\bPlease note that /gi,
  /\bIt is (?:important|worth) (?:to note|noting) that /gi,
  /\bIn order to /gi,
  /\bFor the purpose of /gi,
  /\bAs a result of /gi,
  /\bWith the help of /gi,
  /\bAt this point in time/gi,
  /\bDue to the fact that/gi,
  /\bIn the event that/gi,
  /\bIt should be noted that /gi,
  /\bAs mentioned (?:above|below|earlier|previously),? ?/gi,
  /\bbasically /gi,
  /\bessentially /gi,
  /\brespectively\.?/gi,
  /\betc\.?/gi,
  /\be\.g\.?,? ?/gi,
  /\bi\.e\.?,? ?/gi,
];

// Schema properties that can be removed without losing function
const REMOVABLE_SCHEMA_KEYS = ['examples', 'default', '$schema', 'title', 'additionalProperties'];

export class SkillCompressor {
  private options: Required<SkillCompressorOptions>;
  private totalSavedTokens = 0;

  constructor(options: SkillCompressorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Optimize a set of tools for a given user message
   */
  optimize(
    tools: CompressedTool[],
    userMessage?: string
  ): { tools: CompressedTool[]; stats: { originalTokens: number; optimizedTokens: number; savedTokens: number } } {
    const originalTokens = countToolTokens(tools);
    let optimized = [...tools];

    // Step 1: Filter by relevance
    if (this.options.filterByRelevance && userMessage && tools.length > this.options.maxTools) {
      optimized = this.filterByRelevance(optimized, userMessage);
    }

    // Step 2: Compress descriptions
    if (this.options.compressDescriptions) {
      optimized = optimized.map(tool => this.compressDescription(tool));
    }

    // Step 3: Minify schemas
    if (this.options.minifySchemas) {
      optimized = optimized.map(tool => this.minifySchema(tool));
    }

    const optimizedTokens = countToolTokens(optimized);
    const savedTokens = originalTokens - optimizedTokens;
    this.totalSavedTokens += Math.max(0, savedTokens);

    return {
      tools: optimized,
      stats: {
        originalTokens,
        optimizedTokens,
        savedTokens: Math.max(0, savedTokens),
      },
    };
  }

  /**
   * Score tools by relevance to the user message and keep top N
   */
  private filterByRelevance(tools: CompressedTool[], userMessage: string): CompressedTool[] {
    const messageLower = userMessage.toLowerCase();
    const messageWords = new Set(messageLower.split(/\s+/).filter(w => w.length > 2));

    const scored = tools.map(tool => {
      let score = 0;
      const name = tool.function.name.toLowerCase();
      const desc = (tool.function.description || '').toLowerCase();

      // Name match is strong signal
      for (const word of messageWords) {
        if (name.includes(word)) score += 10;
        if (desc.includes(word)) score += 2;
      }

      // Exact name mention in message
      if (messageLower.includes(name)) score += 20;

      // Partial name match (e.g., "search" in "web_search")
      const nameParts = name.split(/[_-]/);
      for (const part of nameParts) {
        if (messageLower.includes(part) && part.length > 3) score += 5;
      }

      return { tool, score };
    });

    // Sort by score desc, keep top N
    scored.sort((a, b) => b.score - a.score);

    // Always include tools with score > 0, up to maxTools
    const relevant = scored.filter(s => s.score > 0).slice(0, this.options.maxTools);

    // If not enough relevant tools, pad with first N tools (they might be important)
    if (relevant.length < this.options.maxTools) {
      const remaining = scored
        .filter(s => s.score === 0)
        .slice(0, this.options.maxTools - relevant.length);
      relevant.push(...remaining);
    }

    return relevant.map(s => s.tool);
  }

  /**
   * Compress tool description text
   */
  private compressDescription(tool: CompressedTool): CompressedTool {
    let desc = tool.function.description;
    if (!desc) return tool;

    // Apply filler removal
    for (const pattern of FILLER_PATTERNS) {
      desc = desc.replace(pattern, '');
    }

    // Remove redundant whitespace
    desc = desc.replace(/\s+/g, ' ').trim();

    // Remove trailing period if it's a single sentence
    if (!desc.includes('. ') && desc.endsWith('.')) {
      desc = desc.slice(0, -1);
    }

    return {
      ...tool,
      function: {
        ...tool.function,
        description: desc,
      },
    };
  }

  /**
   * Minify JSON schema by removing non-essential properties
   */
  private minifySchema(tool: CompressedTool): CompressedTool {
    if (!tool.function.parameters) return tool;

    const minified = this.minifyObject(tool.function.parameters);

    return {
      ...tool,
      function: {
        ...tool.function,
        parameters: minified,
      },
    };
  }

  private minifyObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Skip removable keys
      if (REMOVABLE_SCHEMA_KEYS.includes(key)) continue;

      // Recursively minify nested objects
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.minifyObject(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  getTotalSavedTokens(): number {
    return this.totalSavedTokens;
  }
}
