/**
 * AI orchestrator - manages LLM calls and integrates with cache/context
 */

import type { Explanation } from '../models/Explanation.js';
import type { RepoContext } from '../models/Context.js';
import type { UntitledConfig } from '../models/Config.js';
import { createExplanation } from '../models/Explanation.js';
import { PromptBuilder } from './PromptBuilder.js';
import { OpenRouterProvider } from './providers/OpenRouterProvider.js';
import { createLogger } from '../utils/Logger.js';

type AIProvider = OpenRouterProvider;

export class AIOrchestrator {
  private readonly promptBuilder = new PromptBuilder();
  private provider: AIProvider | null = null;
  private readonly logger = createLogger();

  constructor(private readonly config: UntitledConfig) {
    if (!config.apiKey) return;
    if (config.aiProvider === 'openrouter') {
      this.provider = new OpenRouterProvider({
        apiKey: config.apiKey,
        model: config.openRouterModel ?? 'nvidia/nemotron-3-nano-30b-a3b:free',
        maxTokens: 1024,
      });
    }
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
      throw new Error('No AI provider configured. Set apiKey and aiProvider in config.');
    }
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
        aiProvider: this.config.aiProvider,
        tokenCount: (usage?.input ?? 0) + (usage?.output ?? 0),
      },
    });
  }

  setApiKey(apiKey: string): void {
    if (!apiKey) {
      this.provider = null;
      return;
    }
    if (this.config.aiProvider === 'openrouter') {
      this.provider = new OpenRouterProvider({
        apiKey,
        model: this.config.openRouterModel ?? 'nvidia/nemotron-3-nano-30b-a3b:free',
        maxTokens: 1024,
      });
    }
  }
}
