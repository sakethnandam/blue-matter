/**
 * LLM client for contextual summary + "see alternatives" per concept.
 * Supports OpenAI, Anthropic, and OpenRouter (including free models) via user's API key.
 */

export interface LLMExplanation {
  summary: string;
  alternatives: string[];
}

const SYSTEM_PROMPT = `You explain code concepts in context. Be concise.
For each request you will receive:
1) A code snippet (file or selection)
2) A concept name (e.g. deque, list comprehension)

Respond with exactly two parts, in this format:

SUMMARY:
(One short paragraph: how this concept is used in the given code and why it works well here. 2-4 sentences.)

ALTERNATIVES:
- (First alternative, e.g. "list: would work but ...")
- (Second alternative if relevant)
- (Third if relevant)

Use plain text. No markdown headers. Keep SUMMARY and ALTERNATIVES sections as shown.`;

function buildUserPrompt(code: string, conceptLabel: string): string {
  return `Concept: ${conceptLabel}\n\nCode:\n${code}`;
}

function parseResponse(text: string): LLMExplanation {
  const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=ALTERNATIVES:|$)/i);
  const alternativesMatch = text.match(/ALTERNATIVES:\s*([\s\S]*?)$/i);
  const summary = (summaryMatch?.[1] ?? text).trim();
  const alternativesBlock = (alternativesMatch?.[1] ?? '').trim();
  const alternatives = alternativesBlock
    .split(/\n/)
    .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean);
  return { summary, alternatives };
}

export type LLMProvider = 'openai' | 'anthropic' | 'openrouter';

export async function fetchExplanation(
  provider: LLMProvider,
  apiKey: string,
  code: string,
  conceptLabel: string,
  openRouterModel?: string
): Promise<LLMExplanation | null> {
  if (!apiKey.trim()) return null;
  const userPrompt = buildUserPrompt(code, conceptLabel);

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 512,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return parseResponse(content);
  }

  if (provider === 'openrouter') {
    const model = (openRouterModel?.trim() || 'google/gemma-3-4b-it:free');
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 512,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return parseResponse(content);
  }

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((c) => c.type === 'text')?.text;
    if (!text) return null;
    return parseResponse(text);
  }

  return null;
}
