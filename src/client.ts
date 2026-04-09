/**
 * TokenWise Client — OpenAI-compatible wrapper with automatic optimization
 *
 * Usage:
 *   import { TokenWise } from 'tokenwise';
 *   const tw = new TokenWise({ apiKey: process.env.OPENAI_API_KEY });
 *   const res = await tw.chat.completions.create({ model: 'gpt-4o', messages: [...] });
 *   console.log(tw.savings()); // see how much you saved
 */

import OpenAI from 'openai';
import type { TokenWiseConfig, CompressedTool, ChatMessage } from './types';
import { ContextDiffer } from './modules/context-differ';
import { SkillCompressor } from './modules/skill-compressor';
import { ModelRouter } from './modules/model-router';
import { CostTracker } from './modules/cost-tracker';
import { countMessageTokens, countToolTokens } from './utils/token-counter';

export class TokenWise {
  private openai: OpenAI;
  private config: TokenWiseConfig;
  private contextDiffer: ContextDiffer;
  private skillCompressor: SkillCompressor;
  private modelRouter: ModelRouter;
  private costTracker: CostTracker;
  private requestCount = 0;

  public chat: {
    completions: {
      create: (params: OpenAI.Chat.ChatCompletionCreateParams) => Promise<OpenAI.Chat.ChatCompletion>;
    };
  };

  constructor(config: TokenWiseConfig) {
    this.config = {
      contextDiffer: true,
      skillCompressor: true,
      modelRouter: true,
      trackCosts: true,
      verbose: false,
      ...config,
    };

    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    this.contextDiffer = new ContextDiffer();
    this.skillCompressor = new SkillCompressor();
    this.modelRouter = new ModelRouter({
      rules: config.routingRules,
    });
    this.costTracker = new CostTracker();

    // Bind the chat.completions.create method
    this.chat = {
      completions: {
        create: this.createCompletion.bind(this),
      },
    };
  }

  /**
   * Create a chat completion with automatic optimization
   */
  private async createCompletion(
    params: OpenAI.Chat.ChatCompletionCreateParams
  ): Promise<OpenAI.Chat.ChatCompletion> {
    this.requestCount++;
    const optimizations: string[] = [];
    const conversationId = this.getConversationId(params);
    const originalModel = params.model;

    // Track original tokens
    const originalMessages = params.messages as ChatMessage[];
    const originalInputTokens = countMessageTokens(originalMessages) +
      (params.tools ? countToolTokens(params.tools as CompressedTool[]) : 0);

    let optimizedParams = { ...params };

    // Step 1: Context Differ
    if (this.config.contextDiffer) {
      const result = this.contextDiffer.optimize(
        conversationId,
        params.messages as ChatMessage[]
      );
      optimizedParams.messages = result.messages as OpenAI.Chat.ChatCompletionMessageParam[];
      if (result.stats.savedTokens > 0) {
        optimizations.push(`context-differ:-${result.stats.savedTokens}tok`);
      }
    }

    // Step 2: Skill Compressor
    if (this.config.skillCompressor && params.tools) {
      const lastUserMsg = [...(params.messages as ChatMessage[])]
        .reverse()
        .find(m => m.role === 'user');

      const result = this.skillCompressor.optimize(
        params.tools as CompressedTool[],
        lastUserMsg?.content || undefined
      );
      optimizedParams.tools = result.tools as OpenAI.Chat.ChatCompletionTool[];
      if (result.stats.savedTokens > 0) {
        optimizations.push(`skill-compressor:-${result.stats.savedTokens}tok`);
      }
    }

    // Step 3: Model Router
    if (this.config.modelRouter) {
      const result = this.modelRouter.route(
        params.model,
        optimizedParams.messages as ChatMessage[],
        optimizedParams.tools as CompressedTool[] | undefined
      );
      optimizedParams.model = result.model;
      if (result.wasRouted) {
        optimizations.push(`model-router:${params.model}→${result.model}`);
      }
    }

    // Log if verbose
    if (this.config.verbose && optimizations.length > 0) {
      console.log(`[TokenWise #${this.requestCount}] ${optimizations.join(', ')}`);
    }

    // Make the actual API call (force non-streaming for now)
    const response = await this.openai.chat.completions.create({
      ...optimizedParams,
      stream: false,
    }) as OpenAI.Chat.ChatCompletion;

    // Track costs
    if (this.config.trackCosts) {
      const usage = response.usage;
      if (usage) {
        this.costTracker.record({
          model: optimizedParams.model,
          originalModel,
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          originalInputTokens,
          optimizations,
        });
      }
    }

    return response;
  }

  /**
   * Get a conversation ID from params (or generate one)
   */
  private getConversationId(params: OpenAI.Chat.ChatCompletionCreateParams): string {
    // Use a hash of the system message as conversation ID
    // This groups requests with the same system prompt
    const systemMsg = (params.messages as ChatMessage[]).find(m => m.role === 'system');
    if (systemMsg?.content) {
      const crypto = require('crypto');
      return crypto.createHash('md5').update(systemMsg.content).digest('hex').substring(0, 12);
    }
    return 'default';
  }

  /**
   * Get cost savings summary
   */
  savings() {
    return this.costTracker.getSummary();
  }

  /**
   * Print a formatted savings report
   */
  printSavings(): string {
    return this.costTracker.printSummary();
  }

  /**
   * Get the underlying OpenAI client (for unsupported methods)
   */
  getOpenAI(): OpenAI {
    return this.openai;
  }

  /**
   * Get individual module instances for advanced usage
   */
  getModules() {
    return {
      contextDiffer: this.contextDiffer,
      skillCompressor: this.skillCompressor,
      modelRouter: this.modelRouter,
      costTracker: this.costTracker,
    };
  }
}
