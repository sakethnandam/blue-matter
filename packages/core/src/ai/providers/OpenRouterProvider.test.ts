import { jest } from '@jest/globals';
import { OpenRouterProvider, DEFAULT_OPENROUTER_FREE_MODEL, FALLBACK_OPENROUTER_FREE_MODEL } from './OpenRouterProvider.js';

type FetchMockResponse = { ok: boolean; status: number; body: object | string; contentType?: string };

function makeFetchMock(responses: FetchMockResponse[]) {
  let callCount = 0;
  return jest.fn().mockImplementation(() => {
    const r = responses[callCount] ?? responses[responses.length - 1];
    callCount++;
    const bodyText = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    const bodyObj = typeof r.body === 'string' ? JSON.parse(r.body) : r.body;
    const ct = r.contentType ?? (r.ok ? 'application/json' : 'application/json');
    return Promise.resolve({
      ok: r.ok,
      status: r.status,
      headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? ct : null },
      json: () => Promise.resolve(bodyObj),
      text: () => Promise.resolve(bodyText),
    });
  });
}

const successBody = {
  choices: [{ message: { content: 'Hello world explanation' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 15, completion_tokens: 25 },
};

describe('OpenRouterProvider', () => {
  let provider: OpenRouterProvider;

  beforeEach(() => {
    provider = new OpenRouterProvider({ apiKey: 'sk-or-v1-test', model: DEFAULT_OPENROUTER_FREE_MODEL });
  });

  afterEach(() => {
    // Clean up global fetch mock
    (globalThis as Record<string, unknown>).fetch = undefined;
  });

  it('returns text and usage on successful response', async () => {
    (globalThis as Record<string, unknown>).fetch = makeFetchMock([{ ok: true, status: 200, body: successBody }]);
    const result = await provider.explain('system prompt', 'user prompt');
    expect(result.text).toBe('Hello world explanation');
    expect(result.usage?.input).toBe(15);
    expect(result.usage?.output).toBe(25);
  });

  it('falls back to FALLBACK_OPENROUTER_FREE_MODEL on 404 and succeeds', async () => {
    const mock = makeFetchMock([
      { ok: false, status: 404, body: { error: { message: 'model not found' } } },
      { ok: true, status: 200, body: successBody },
    ]);
    (globalThis as Record<string, unknown>).fetch = mock;
    const result = await provider.explain('system', 'user');
    expect(result.text).toBe('Hello world explanation');
    // Second call should use the fallback model
    const secondCallBody = JSON.parse((mock.mock.calls[1] as [string, { body: string }])[1].body);
    expect(secondCallBody.model).toBe(FALLBACK_OPENROUTER_FREE_MODEL);
  });

  it('throws with free-models hint when both primary and fallback return 404', async () => {
    (globalThis as Record<string, unknown>).fetch = makeFetchMock([
      { ok: false, status: 404, body: { error: { message: 'not found' } } },
      { ok: false, status: 404, body: { error: { message: 'still not found' } } },
    ]);
    await expect(provider.explain('system', 'user')).rejects.toThrow('openrouter.ai');
  });

  it('throws with status code on non-404 HTTP error', async () => {
    (globalThis as Record<string, unknown>).fetch = makeFetchMock([
      { ok: false, status: 429, body: { error: { message: 'rate limited' } } },
    ]);
    await expect(provider.explain('s', 'u')).rejects.toThrow('429');
  });

  it('error message includes extracted error text but not raw JSON envelope', async () => {
    (globalThis as Record<string, unknown>).fetch = makeFetchMock([
      { ok: false, status: 400, body: { error: { message: 'invalid request body' } } },
    ]);
    let errorMessage = '';
    try {
      await provider.explain('s', 'u');
    } catch (e) {
      errorMessage = (e as Error).message;
    }
    expect(errorMessage).toContain('invalid request body');
    // Should not contain the raw JSON wrapper keys
    expect(errorMessage).not.toContain('"choices"');
  });

  it('defaults to DEFAULT_OPENROUTER_FREE_MODEL when no model provided', () => {
    const p = new OpenRouterProvider({ apiKey: 'sk-or-v1-x' });
    // Access private field via cast to verify default
    expect((p as unknown as { model: string }).model).toBe(DEFAULT_OPENROUTER_FREE_MODEL);
  });

  it('sends Authorization header with Bearer token', async () => {
    const mock = makeFetchMock([{ ok: true, status: 200, body: successBody }]);
    (globalThis as Record<string, unknown>).fetch = mock;
    await provider.explain('sys', 'usr');
    const headers = (mock.mock.calls[0] as [string, { headers: Record<string, string> }])[1].headers;
    expect(headers['Authorization']).toBe('Bearer sk-or-v1-test');
  });

  it('does not include raw API key in error messages', async () => {
    const apiKey = 'sk-or-v1-supersecretkey12345';
    const secretProvider = new OpenRouterProvider({ apiKey, model: DEFAULT_OPENROUTER_FREE_MODEL });
    (globalThis as Record<string, unknown>).fetch = makeFetchMock([
      { ok: false, status: 401, body: { error: { message: 'Unauthorized' } } },
    ]);
    let errorMessage = '';
    try {
      await secretProvider.explain('s', 'u');
    } catch (e) {
      errorMessage = (e as Error).message;
    }
    expect(errorMessage).not.toContain(apiKey);
  });
});
