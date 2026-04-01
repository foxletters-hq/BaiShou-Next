import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicAdaptedProvider } from '../anthropic.provider';

global.fetch = vi.fn();

describe('AnthropicAdaptedProvider', () => {
  let provider: AnthropicAdaptedProvider;

  beforeEach(() => {
    vi.resetAllMocks();
    provider = new AnthropicAdaptedProvider({
      id: 'test_anthropic',
      name: 'Anthropic',
      type: 'anthropic',
      apiKey: 'test-key',
      baseUrl: 'https://test-anthropic.com'
    } as any);
  });

  describe('fetchAvailableModels', () => {
    it('should return default model list', async () => {
      const models = await provider.fetchAvailableModels();
      expect(models).toContain('claude-3-5-sonnet-20241022');
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('testConnection', () => {
    it('should throw error if apiKey is missing', async () => {
      provider = new AnthropicAdaptedProvider({
        id: 'test_anthropic', name: 'Anthropic', type: 'anthropic', apiKey: ''
      } as any);
      await expect(provider.testConnection()).rejects.toThrow('Anthropic API Key is required');
    });

    it('should throw error if fetch returns not ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized'
      } as Response);

      await expect(provider.testConnection()).rejects.toThrow('Anthropic connection test failed: Unauthorized');
    });

    it('should resolve if fetch indicates success', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true
      } as Response);

      await expect(provider.testConnection()).resolves.toBeUndefined();
      
      expect(fetch).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'test-key'
        })
      }));
    });
  });
});
