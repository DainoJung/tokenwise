/**
 * TokenWise Anthropic Client — Anthropic SDK-compatible wrapper with automatic optimization
 *
 * Usage:
 *   import { TokenWiseAnthropic } from '@daino/tokenwise';
 *   const tw = new TokenWiseAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
 *   const res = await tw.messages.create({
 *     model: 'claude-sonnet-4-6',
 *     max_tokens: 1024,
 *     messages: [{ role: 'user', content: 'Hello!' }],
 *   });
 */

import type { CompressedTool, ChatMessage } from './types';
import { SkillCompressor } from './modules/skill-compressor';
import { ModelRouter } from './modules/model-router';
import { CostTracker } from './modules/cost-tracker';
import { countMessageTokens, countToolTokens } from './utils/token-counter';

export interface AnthropicConfig {
  apiKey: string;
  baseURL?: string;
  skillCompressor?: boolean;
  modelRouter?: boolean;
  trackCosts?: boolean;
  verbose?: boolean;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface AnthropicCreateParams {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: string;
  tools?: AnthropicTool[];
  stream?: boolean;
  [key: string]: unknown;
}

interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
  stop_reason: string;
}

export class TokenWiseAnthropic {
  private apiKey: string;
  private baseURL: string;
  private config: AnthropicConfig;
  private skillCompressor: SkillCompressor;
  private modelRouter: ModelRouter;
  private costTracker: CostTracker;
  private requestCount = 0;

  public messages: {
    create: (params: AnthropicCreateParams) => Promise<AnthropicResponse>;
  };

  constructor(config: AnthropicConfig) {
    this.config = {
      skillCompressor: true,
      modelRouter: true,
      trackCosts: true,
      verbose: false,
      ...config,
    };

    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.anthropic.com';
    this.skillCompressor = new SkillCompressor();
    this.modelRouter = new ModelRouter();
    this.costTracker = new CostTracker();

    this.messages = {
      create: this.createMessage.bind(this),
    };
  }

  private async createMessage(params: AnthropicCreateParams): Promise<AnthropicResponse> {
    this.requestCount++;
    const optimizations: string[] = [];
    const originalModel = params.model;

    // Convert to internal format for optimization
    const internalMessages = this.toInternalMessages(params);
    const internalTools = params.tools ? this.toInternalTools(params.tools) : undefined;

    const originalInputTokens = countMessageTokens(internalMessages) +
      (internalTools ? countToolTokens(internalTools) : 0);

    let optimizedParams = { ...params };

    // Skill Compressor
    if (this.config.skillCompressor && params.tools && params.tools.length > 0) {
      const lastUserMsg = internalMessages.filter(m => m.role === 'user').pop();
      const result = this.skillCompressor.optimize(internalTools!, lastUserMsg?.content || undefined);
      optimizedParams.tools = this.fromInternalTools(result.tools);
      if (result.stats.savedTokens > 0) {
        optimizations.push(`skill-compressor:-${result.stats.savedTokens}tok`);
      }
    }

    // Model Router
    if (this.config.modelRouter) {
      const result = this.modelRouter.route(params.model, internalMessages, internalTools);
      optimizedParams.model = result.model;
      if (result.wasRouted) {
        optimizations.push(`model-router:${params.model}→${result.model}`);
      }
    }

    if (this.config.verbose && optimizations.length > 0) {
      console.log(`[TokenWise #${this.requestCount}] ${optimizations.join(', ')}`);
    }

    // Make the actual API call
    const response = await this.callAnthropicAPI(optimizedParams);

    // Track costs
    if (this.config.trackCosts && response.usage) {
      this.costTracker.record({
        model: optimizedParams.model,
        originalModel,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        originalInputTokens,
        optimizations,
      });
    }

    return response;
  }

  private async callAnthropicAPI(params: AnthropicCreateParams): Promise<AnthropicResponse> {
    const { stream, ...body } = params;
    const res = await fetch(`${this.baseURL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${error}`);
    }

    return res.json() as Promise<AnthropicResponse>;
  }

  private toInternalMessages(params: AnthropicCreateParams): ChatMessage[] {
    const messages: ChatMessage[] = [];
    if (params.system) {
      messages.push({ role: 'system', content: params.system });
    }
    for (const msg of params.messages) {
      const content = typeof msg.content === 'string'
        ? msg.content
        : msg.content.map(b => b.text || '').join('\n');
      messages.push({ role: msg.role, content });
    }
    return messages;
  }

  private toInternalTools(tools: AnthropicTool[]): CompressedTool[] {
    return tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));
  }

  private fromInternalTools(tools: CompressedTool[]): AnthropicTool[] {
    return tools.map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters || {},
    }));
  }

  savings() {
    return this.costTracker.getSummary();
  }

  printSavings(): string {
    return this.costTracker.printSummary();
  }
}
