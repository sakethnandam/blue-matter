/**
 * Unit tests for OpenRouterProvider (mocked fetch)
 */

import {
  OpenRouterProvider,
  DEFAULT_OPENROUTER_FREE_MODEL,
  FALLBACK_OPENROUTER_FREE_MODEL,
} from '../../../../src/ai/providers/OpenRouterProvider';

describe('OpenRouterProvider', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as typeof fetch;
  });

  describe('successful responses', () => {
    it('parses successful API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'This declares a constant.' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 20, completion_tokens: 10 },
        }),
      });

      const provider = new OpenRouterProvider({ apiKey: 'sk-or-v1-test' });
      const result = await provider.explain('system', 'user');

      expect(result.text).toBe('This declares a constant.');
      expect(result.usage).toEqual({ input: 20, output: 10 });
    });

    it('uses default model when not specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'x' } }], usage: {} }),
      });

      const provider = new OpenRouterProvider({ apiKey: 'sk-key' });
      await provider.explain('sys', 'usr');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer sk-key',
          }),
          body: expect.stringContaining(DEFAULT_OPENROUTER_FREE_MODEL),
        })
      );
    });

    it('sends API key in Authorization header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'x' } }] }),
      });

      const provider = new OpenRouterProvider({ apiKey: 'sk-or-v1-my-secret-key' });
      await provider.explain('sys', 'usr');

      const call = mockFetch.mock.calls[0];
      expect(call[1].headers.Authorization).toBe('Bearer sk-or-v1-my-secret-key');
    });

    it('sends system and user messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'x' } }] }),
      });

      const provider = new OpenRouterProvider({ apiKey: 'sk-key' });
      await provider.explain('You are a helper', 'Explain this: const x=1');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0]).toEqual({ role: 'system', content: 'You are a helper' });
      expect(body.messages[1]).toEqual({ role: 'user', content: 'Explain this: const x=1' });
    });
  });

  describe('error handling', () => {
    it('sanitizes error message - does not leak raw body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({
            error: { message: 'Invalid API key' },
            internal: 'sk-or-v1-leaked-secret-key',
          }),
      });

      const provider = new OpenRouterProvider({ apiKey: 'sk-key' });
      try {
        await provider.explain('sys', 'usr');
      } catch (err) {
        const msg = (err as Error).message;
        expect(msg).toContain('Open Router API error 401');
        expect(msg).toContain('Invalid API key');
        expect(msg).not.toContain('leaked-secret');
        return;
      }
      throw new Error('Expected explain to throw');
    });

    it('handles 500 error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ error: { message: 'Server error' } }),
      });

      const provider = new OpenRouterProvider({ apiKey: 'sk-key' });
      await expect(provider.explain('sys', 'usr')).rejects.toThrow('Open Router API error 500');
      await expect(provider.explain('sys', 'usr')).rejects.toThrow('Server error');
    });

    it('uses fallback model on 404', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: async () => JSON.stringify({ error: { message: 'Model not found' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Fallback response' } }],
            usage: { prompt_tokens: 5, completion_tokens: 5 },
          }),
        });

      const provider = new OpenRouterProvider({ apiKey: 'sk-key' });
      const result = await provider.explain('sys', 'usr');

      expect(result.text).toBe('Fallback response');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(secondCallBody.model).toBe(FALLBACK_OPENROUTER_FREE_MODEL);
    });

    it('throws when fallback also fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => '{}',
      });

      const provider = new OpenRouterProvider({ apiKey: 'sk-key' });
      await expect(provider.explain('sys', 'usr')).rejects.toThrow('Open Router API error 404');
      await expect(provider.explain('sys', 'usr')).rejects.toThrow('openrouter.ai/collections/free-models');
    });

    it('handles malformed JSON in error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        text: async () => 'not valid json {{{',
      });

      const provider = new OpenRouterProvider({ apiKey: 'sk-key' });
      await expect(provider.explain('sys', 'usr')).rejects.toThrow('Open Router API error 502');
      await expect(provider.explain('sys', 'usr')).rejects.toThrow('Check your model setting');
    });
  });

  describe('exports', () => {
    it('exports default and fallback model constants', () => {
      expect(DEFAULT_OPENROUTER_FREE_MODEL).toBe('nvidia/nemotron-3-nano-30b-a3b:free');
      expect(FALLBACK_OPENROUTER_FREE_MODEL).toBe('meta-llama/llama-3.3-70b-instruct:free');
    });
  });
});
