/**
 * Token counting utilities using tiktoken
 */

import { get_encoding, type Tiktoken } from 'tiktoken';

let encoder: Tiktoken | null = null;

function getEncoder(): Tiktoken {
  if (!encoder) {
    encoder = get_encoding('cl100k_base');
  }
  return encoder;
}

export function countTokens(text: string): number {
  if (!text) return 0;
  return getEncoder().encode(text).length;
}

export function countMessageTokens(messages: Array<{ role: string; content: string | null; name?: string }>): number {
  let total = 0;
  for (const msg of messages) {
    // Every message has overhead: <|start|>{role}\n{content}<|end|>\n
    total += 4;
    if (msg.content) {
      total += countTokens(msg.content);
    }
    if (msg.role) {
      total += countTokens(msg.role);
    }
    if (msg.name) {
      total += countTokens(msg.name);
      total -= 1; // role is omitted if name is present
    }
  }
  total += 2; // every reply is primed with <|start|>assistant
  return total;
}

export function countToolTokens(tools: Array<{ type: string; function: { name: string; description: string; parameters?: Record<string, unknown> } }>): number {
  let total = 0;
  for (const tool of tools) {
    const fn = tool.function;
    total += countTokens(fn.name);
    total += countTokens(fn.description);
    if (fn.parameters) {
      total += countTokens(JSON.stringify(fn.parameters));
    }
    total += 10; // overhead per tool definition
  }
  return total;
}
