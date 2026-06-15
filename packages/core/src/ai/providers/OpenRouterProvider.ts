/**
 * Open Router API provider - uses OpenAI-compatible chat completions.
 * Supports free models (e.g. nvidia/nemotron-3-nano-30b-a3b:free).
 * Docs: https://openrouter.ai/docs/api-reference/chat-completion
 * PRD 6.2: Error messages never include raw body or secrets.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Default free model on Open Router (NVIDIA Nemotron 3 Nano 30B; PRD 6.2: no secrets in logs) */
export const DEFAULT_OPENROUTER_FREE_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free';

/** Fallback free model when primary returns 404 (model not configured in Gateway). */
export const FALLBACK_OPENROUTER_FREE_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

export interface OpenRouterProviderConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export interface OpenRouterUsage {
  input: number;
  output: number;
}

/** Build user-facing error message from status and body; never include raw body or secrets (PRD 6.2). */
function sanitizedError(status: number, bodyText: string, is404Hint?: boolean): string {
  let message = `Open Router API error ${status}`;
  try {
    const parsed = JSON.parse(bodyText) as { error?: { message?: string } };
    const errMsg = parsed?.error?.message;
    if (typeof errMsg === 'string' && errMsg.trim()) {
      message += `: ${errMsg.trim()}`;
    }
  } catch {
    message += '. Check your model setting and connection.';
    return message;
  }
  if (status === 404 || is404Hint) {
    message += ' Try changing Blue Matter: Open Router Model in settings to a current free model (see openrouter.ai/collections/free-models).';
  }
  return message;
}

export class OpenRouterProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: OpenRouterProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? DEFAULT_OPENROUTER_FREE_MODEL;
    this.maxTokens = config.maxTokens ?? 1024;
  }

  private async requestWithModel(
    model: string,
    systemPrompt: string,
    userPrompt: string
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);
    try {
      return await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/blue-matter',
        },
        body: JSON.stringify({
          model,
          max_tokens: this.maxTokens,
          temperature: 0,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Request timed out after 30 seconds. Check your connection and try again.');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async parseSuccessResponse(response: Response): Promise<{ text: string; usage?: OpenRouterUsage }> {
    const ct = response.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) {
      throw new Error('Unexpected response from OpenRouter. Check your connection and try again.');
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const MAX_RESPONSE_CHARS = 50_000;
    const rawContent = data.choices?.[0]?.message?.content ?? '';
    const content = typeof rawContent === 'string' ? rawContent.slice(0, MAX_RESPONSE_CHARS) : '';
    const usage = data.usage
      ? { input: data.usage.prompt_tokens ?? 0, output: data.usage.completion_tokens ?? 0 }
      : undefined;
    return { text: content.trim(), usage };
  }

  async explain(systemPrompt: string, userPrompt: string): Promise<{ text: string; usage?: OpenRouterUsage }> {
    let response = await this.requestWithModel(this.model, systemPrompt, userPrompt);

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 404) {
        const fallbackResponse = await this.requestWithModel(
          FALLBACK_OPENROUTER_FREE_MODEL,
          systemPrompt,
          userPrompt
        );
        if (fallbackResponse.ok) {
          return this.parseSuccessResponse(fallbackResponse);
        }
        const fallbackErrText = await fallbackResponse.text();
        throw new Error(
          sanitizedError(fallbackResponse.status, fallbackErrText, true)
        );
      }
      throw new Error(sanitizedError(response.status, errText));
    }

    return this.parseSuccessResponse(response);
  }
}
