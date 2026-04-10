/**
 * Output Compactor — Response format optimization
 *
 * Problem: LLM responses often contain verbose formatting, redundant
 * explanations, and unnecessary tokens that inflate costs when the
 * response is fed back into subsequent agent calls.
 *
 * Solution: Compact LLM output before it's stored or passed to the
 * next agent in a chain, reducing input tokens for downstream calls.
 */

import { countTokens } from '../utils/token-counter';

export interface OutputCompactorOptions {
  /** Remove markdown formatting (default: true) */
  stripMarkdown?: boolean;
  /** Remove filler phrases from output (default: true) */
  removeFiller?: boolean;
  /** Truncate to max tokens (0 = no limit, default: 0) */
  maxOutputTokens?: number;
  /** Compact JSON in responses (default: true) */
  compactJSON?: boolean;
}

const DEFAULT_OPTIONS: Required<OutputCompactorOptions> = {
  stripMarkdown: true,
  removeFiller: true,
  maxOutputTokens: 0,
  compactJSON: true,
};

const OUTPUT_FILLER_PATTERNS: RegExp[] = [
  /\bCertainly!?\s*/gi,
  /\bOf course!?\s*/gi,
  /\bSure!?\s*/gi,
  /\bAbsolutely!?\s*/gi,
  /\bGreat question!?\s*/gi,
  /\bThat's a great question!?\s*/gi,
  /\bI'd be happy to help\.?\s*/gi,
  /\bI'll help you with that\.?\s*/gi,
  /\bLet me help you with that\.?\s*/gi,
  /\bHere'?s? (?:the |my |an? )?(?:answer|response|explanation|summary)(?:\s+(?:to|for) (?:that|your question|you))?[.:]\s*/gi,
  /\bAs (?:an? )?AI (?:language model|assistant)?,?\s*/gi,
  /\bI hope (?:this|that) helps!?\s*/gi,
  /\bLet me know if you (?:need|have|want) (?:anything|any(?:thing)? else|more (?:help|information|details))\.?\s*/gi,
  /\bFeel free to ask (?:if|me) .*?[.!]\s*/gi,
  /\bIs there anything else .*?\?\s*/gi,
];

export class OutputCompactor {
  private options: Required<OutputCompactorOptions>;
  private totalSavedTokens = 0;

  constructor(options: OutputCompactorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Compact an LLM response for downstream use
   */
  compact(output: string): { text: string; stats: { originalTokens: number; compactedTokens: number; savedTokens: number } } {
    const originalTokens = countTokens(output);
    let text = output;

    if (this.options.removeFiller) {
      text = this.removeFiller(text);
    }

    if (this.options.stripMarkdown) {
      text = this.stripMarkdown(text);
    }

    if (this.options.compactJSON) {
      text = this.compactJSON(text);
    }

    // Clean up whitespace
    text = text.replace(/\n{3,}/g, '\n\n').trim();

    if (this.options.maxOutputTokens > 0) {
      text = this.truncate(text, this.options.maxOutputTokens);
    }

    const compactedTokens = countTokens(text);
    const savedTokens = Math.max(0, originalTokens - compactedTokens);
    this.totalSavedTokens += savedTokens;

    return {
      text,
      stats: { originalTokens, compactedTokens, savedTokens },
    };
  }

  private removeFiller(text: string): string {
    for (const pattern of OUTPUT_FILLER_PATTERNS) {
      text = text.replace(pattern, '');
    }
    return text;
  }

  private stripMarkdown(text: string): string {
    return text
      // Headers → plain text
      .replace(/^#{1,6}\s+/gm, '')
      // Bold/italic
      .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
      .replace(/_{1,3}(.*?)_{1,3}/g, '$1')
      // Inline code (keep content)
      .replace(/`([^`]+)`/g, '$1')
      // Horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, '')
      // Bullet points → compact
      .replace(/^\s*[-*+]\s+/gm, '- ')
      // Numbered lists → compact
      .replace(/^\s*\d+\.\s+/gm, (match) => match.trim() + ' ');
  }

  private compactJSON(text: string): string {
    // Find JSON blocks and minify them
    return text.replace(/```json\s*([\s\S]*?)```/g, (_match, json) => {
      try {
        const parsed = JSON.parse(json.trim());
        return JSON.stringify(parsed);
      } catch {
        return json.trim();
      }
    });
  }

  private truncate(text: string, maxTokens: number): string {
    const tokens = countTokens(text);
    if (tokens <= maxTokens) return text;

    // Binary search for the right length
    let low = 0;
    let high = text.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (countTokens(text.substring(0, mid)) <= maxTokens) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return text.substring(0, Math.max(0, low - 1)) + '...';
  }

  getTotalSavedTokens(): number {
    return this.totalSavedTokens;
  }
}
