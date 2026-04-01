/**
 * AI orchestrator - manages LLM calls and integrates with cache/context
 */

import type { Explanation } from '../models/Explanation.js';
import type { RepoContext } from '../models/Context.js';
import type { UntitledConfig } from '../models/Config.js';
import { createExplanation } from '../models/Explanation.js';
import { PromptBuilder } from './PromptBuilder.js';
import { OpenRouterProvider, DEFAULT_OPENROUTER_FREE_MODEL } from './providers/OpenRouterProvider.js';
import { createLogger } from '../utils/Logger.js';

export class AIOrchestrator {
  private readonly promptBuilder = new PromptBuilder();
  private provider: OpenRouterProvider | null = null;
  private readonly logger = createLogger();
  /** Sliding-window rate limiter: stores Unix timestamps (ms) of AI calls in the last hour. */
  private readonly callTimestamps: number[] = [];

  constructor(private readonly config: UntitledConfig) {
    if (!config.apiKey) return;
    this.provider = new OpenRouterProvider({
      apiKey: config.apiKey,
      model: config.openRouterModel ?? DEFAULT_OPENROUTER_FREE_MODEL,
      maxTokens: 1024,
    });
  }

  /** Enforce per-hour rate limit using a sliding window over callTimestamps. */
  private checkRateLimit(): void {
    const now = Date.now();
    const windowStart = now - 3_600_000; // 1 hour
    // Evict timestamps outside the window
    while (this.callTimestamps.length > 0 && this.callTimestamps[0] < windowStart) {
      this.callTimestamps.shift();
    }
    const limit = this.config.rateLimits?.explanationsPerHour ?? 100;
    if (this.callTimestamps.length >= limit) {
      throw new Error(`Rate limit reached: max ${limit} AI explanations per hour. Try again later.`);
    }
    this.callTimestamps.push(now);
  }

  async explain(
    code: string,
    context: RepoContext,
    options: { codeHash: string; filePath?: string; language?: string }
  ): Promise<Explanation> {
    if (this.config.privacyMode === 'strict') {
      throw new Error('Strict privacy mode: AI calls are disabled. Use cached explanations only.');
    }
    if (!this.provider) {
      throw new Error('No AI provider configured. Set apiKey in config.');
    }
    this.checkRateLimit();
    const { system, user } = this.promptBuilder.buildExplanationPrompt(code, context);
    const start = Date.now();
    const { text, usage } = await this.provider.explain(system, user);
    const duration = Date.now() - start;
    this.logger.info('AI explanation generated', { duration, inputTokens: usage?.input, outputTokens: usage?.output });
    const summary = text.slice(0, 100);
    return createExplanation({
      codeHash: options.codeHash,
      text,
      summary,
      source: 'ai',
      metadata: {
        language: options.language ?? 'unknown',
        filePath: options.filePath,
        aiProvider: 'openrouter',
        tokenCount: (usage?.input ?? 0) + (usage?.output ?? 0),
      },
    });
  }

  setApiKey(apiKey: string): void {
    if (!apiKey) {
      this.provider = null;
      return;
    }
    this.provider = new OpenRouterProvider({
      apiKey,
      model: this.config.openRouterModel ?? DEFAULT_OPENROUTER_FREE_MODEL,
      maxTokens: 1024,
    });
  }
}
