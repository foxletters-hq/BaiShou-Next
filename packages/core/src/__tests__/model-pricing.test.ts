import { describe, it, expect } from 'vitest';
import { calculateTokenCost, type ModelPrice, type TokenUsage } from '../session/model-pricing.service';

describe('ModelPricingService', () => {
  describe('calculateTokenCost', () => {
    const standardPrice: ModelPrice = {
      input: 3.0,   // $3/M tokens
      output: 15.0,  // $15/M tokens
      cacheRead: 0.3,
      cacheWrite: 3.75,
    };

    it('should calculate basic input + output cost', () => {
      const usage: TokenUsage = {
        inputTokens: 1000,
        outputTokens: 500,
      };

      const cost = calculateTokenCost(standardPrice, usage);

      // 1000 * 3.0 / 1M + 500 * 15.0 / 1M = 0.003 + 0.0075 = 0.0105
      expect(cost).toBeCloseTo(0.0105, 4);
    });

    it('should include cache read cost', () => {
      const usage: TokenUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        cachedInputTokens: 5000,
      };

      const cost = calculateTokenCost(standardPrice, usage);

      // input: 1000 * 3.0 / 1M = 0.003
      // output: 500 * 15.0 / 1M = 0.0075
      // cache: 5000 * 0.3 / 1M = 0.0015
      expect(cost).toBeCloseTo(0.012, 4);
    });

    it('should use 200K+ tiered pricing when context exceeds threshold', () => {
      const tieredPrice: ModelPrice = {
        input: 3.0,
        output: 15.0,
        cacheRead: 0.3,
        cacheWrite: 3.75,
        over200K: {
          input: 6.0,    // 2x price
          output: 30.0,
          cacheRead: 0.6,
          cacheWrite: 7.5,
        },
      };

      const usage: TokenUsage = {
        inputTokens: 150_000,
        outputTokens: 1000,
        cachedInputTokens: 100_000, // total = 250K > 200K
      };

      const cost = calculateTokenCost(tieredPrice, usage);

      // Uses over200K pricing
      // input: 150000 * 6.0 / 1M = 0.9
      // output: 1000 * 30.0 / 1M = 0.03
      // cache: 100000 * 0.6 / 1M = 0.06
      expect(cost).toBeCloseTo(0.99, 2);
    });

    it('should use standard pricing when under 200K threshold', () => {
      const tieredPrice: ModelPrice = {
        input: 3.0,
        output: 15.0,
        cacheRead: 0.3,
        cacheWrite: 3.75,
        over200K: {
          input: 6.0,
          output: 30.0,
          cacheRead: 0.6,
          cacheWrite: 7.5,
        },
      };

      const usage: TokenUsage = {
        inputTokens: 100_000,
        outputTokens: 1000,
        cachedInputTokens: 50_000, // total = 150K < 200K
      };

      const cost = calculateTokenCost(tieredPrice, usage);

      // Uses standard pricing
      // input: 100000 * 3.0 / 1M = 0.3
      // output: 1000 * 15.0 / 1M = 0.015
      // cache: 50000 * 0.3 / 1M = 0.015
      expect(cost).toBeCloseTo(0.33, 2);
    });

    it('should handle zero tokens', () => {
      const usage: TokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
      };

      const cost = calculateTokenCost(standardPrice, usage);
      expect(cost).toBe(0);
    });
  });
});
