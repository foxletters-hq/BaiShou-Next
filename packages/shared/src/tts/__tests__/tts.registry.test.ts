import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TtsProviderRegistry } from '../tts.registry';
import type { TtsProvider } from '../../types/tts.types';

describe('TtsProviderRegistry', () => {
  let registry: TtsProviderRegistry;

  beforeEach(() => {
    registry = new TtsProviderRegistry();
  });

  describe('register', () => {
    it('should register a TTS provider', () => {
      const mockProvider: TtsProvider = {
        id: 'test-provider',
        name: 'Test Provider',
        supportsModel: vi.fn().mockReturnValue(true),
        synthesize: vi.fn(),
      };

      registry.register(mockProvider);

      expect(registry.get('test-provider')).toBe(mockProvider);
    });

    it('should allow registering multiple providers', () => {
      const provider1: TtsProvider = {
        id: 'provider-1',
        name: 'Provider 1',
        supportsModel: vi.fn().mockReturnValue(true),
        synthesize: vi.fn(),
      };
      const provider2: TtsProvider = {
        id: 'provider-2',
        name: 'Provider 2',
        supportsModel: vi.fn().mockReturnValue(false),
        synthesize: vi.fn(),
      };

      registry.register(provider1);
      registry.register(provider2);

      expect(registry.get('provider-1')).toBe(provider1);
      expect(registry.get('provider-2')).toBe(provider2);
    });
  });

  describe('get', () => {
    it('should return undefined for unregistered provider', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });

    it('should return registered provider by id', () => {
      const mockProvider: TtsProvider = {
        id: 'my-provider',
        name: 'My Provider',
        supportsModel: vi.fn(),
        synthesize: vi.fn(),
      };
      registry.register(mockProvider);

      expect(registry.get('my-provider')).toBe(mockProvider);
    });
  });

  describe('list', () => {
    it('should return empty array when no providers registered', () => {
      expect(registry.list()).toEqual([]);
    });

    it('should return all registered providers', () => {
      const provider1: TtsProvider = {
        id: 'p1',
        name: 'P1',
        supportsModel: vi.fn(),
        synthesize: vi.fn(),
      };
      const provider2: TtsProvider = {
        id: 'p2',
        name: 'P2',
        supportsModel: vi.fn(),
        synthesize: vi.fn(),
      };
      registry.register(provider1);
      registry.register(provider2);

      const providers = registry.list();
      expect(providers).toHaveLength(2);
      expect(providers).toContain(provider1);
      expect(providers).toContain(provider2);
    });
  });

  describe('findByModel', () => {
    it('should return provider that supports the given model', () => {
      const provider1: TtsProvider = {
        id: 'p1',
        name: 'P1',
        supportsModel: vi.fn().mockReturnValue(false),
        synthesize: vi.fn(),
      };
      const provider2: TtsProvider = {
        id: 'p2',
        name: 'P2',
        supportsModel: vi.fn().mockReturnValue(true),
        synthesize: vi.fn(),
      };
      registry.register(provider1);
      registry.register(provider2);

      const result = registry.findByModel('some-model');
      expect(result).toBe(provider2);
    });

    it('should return undefined when no provider supports the model', () => {
      const provider: TtsProvider = {
        id: 'p1',
        name: 'P1',
        supportsModel: vi.fn().mockReturnValue(false),
        synthesize: vi.fn(),
      };
      registry.register(provider);

      expect(registry.findByModel('unsupported-model')).toBeUndefined();
    });

    it('should return first matching provider when multiple support the model', () => {
      const provider1: TtsProvider = {
        id: 'p1',
        name: 'P1',
        supportsModel: vi.fn().mockReturnValue(true),
        synthesize: vi.fn(),
      };
      const provider2: TtsProvider = {
        id: 'p2',
        name: 'P2',
        supportsModel: vi.fn().mockReturnValue(true),
        synthesize: vi.fn(),
      };
      registry.register(provider1);
      registry.register(provider2);

      expect(registry.findByModel('some-model')).toBe(provider1);
    });
  });
});
