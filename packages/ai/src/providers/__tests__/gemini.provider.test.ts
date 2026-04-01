import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiAdaptedProvider } from '../gemini.provider';

// Mock fetch globally
global.fetch = vi.fn();

describe('GeminiAdaptedProvider', () => {
  let provider: GeminiAdaptedProvider;

  beforeEach(() => {
    vi.resetAllMocks();
    provider = new GeminiAdaptedProvider({
      id: 'test_gemini',
      name: 'Gemini',
      type: 'gemini',
      apiKey: 'test-key',
      baseUrl: 'https://test-gemini.com'
    } as any);
  });

  describe('fetchAvailableModels', () => {
    it('should return empty array if no apiKey is provided', async () => {
      provider = new GeminiAdaptedProvider({ id: 'test_gemini', name: 'Gemini', type: 'gemini', apiKey: '' } as any);
      const models = await provider.fetchAvailableModels();
      expect(models).toEqual([]);
    });

    it('should fetch and parse models from API', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'models/gemini-pro' }, { name: 'gemini-flash' }]
        })
      } as Response);

      const models = await provider.fetchAvailableModels();
      expect(fetch).toHaveBeenCalledWith('https://test-gemini.com/v1beta/models?key=test-key');
      expect(models).toEqual(['gemini-pro', 'gemini-flash']);
    });

    it('should fallback to default models on fetch error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized'
      } as Response);

      const models = await provider.fetchAvailableModels();
      expect(models).toEqual(['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash']);
    });
  });

  describe('testConnection', () => {
    it('should resolve if models are available', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'models/gemini-pro' }]
        })
      } as Response);
      
      await expect(provider.testConnection()).resolves.toBeUndefined();
    });

    it('should reject if no models available', async () => {
      provider = new GeminiAdaptedProvider({ id: 'test_gemini', name: 'Gemini', type: 'gemini', apiKey: '' } as any);
      await expect(provider.testConnection()).rejects.toThrow('Unable to connect to Gemini API');
    });
  });
});
