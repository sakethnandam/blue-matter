/**
 * Anthropic (Claude) API provider for code explanation
 */

import Anthropic from '@anthropic-ai/sdk';

export interface AnthropicProviderConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export class AnthropicProvider {
  private client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: AnthropicProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model ?? 'claude-3-5-sonnet-20241022';
    this.maxTokens = config.maxTokens ?? 1024;
  }

  async explain(systemPrompt: string, userPrompt: string): Promise<{ text: string; usage?: { input: number; output: number } }> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = message.content.find((b): b is { type: 'text'; text: string } => b.type === 'text');
    const text = textBlock?.text ?? '';
    const usage = message.usage
      ? { input: message.usage.input_tokens, output: message.usage.output_tokens }
      : undefined;
    return { text, usage };
  }
}
