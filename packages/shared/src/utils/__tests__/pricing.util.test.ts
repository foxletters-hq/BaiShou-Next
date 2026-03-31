import { describe, it, expect, vi, beforeEach } from 'vitest';
import { modelPricingService, usdToMicros, microsToUsd } from '../pricing.util';

describe('ModelPricingService (USD) - Async Fallbacks & Tiered Configs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should accurately convert between micros and USD floating point for UI view', () => {
    const costUsd = 0.000125;
    const micros = usdToMicros(costUsd);
    expect(micros).toBe(125);

    const parsedUsd = microsToUsd(125);
    expect(parsedUsd).toBe(0.000125);
  });

  it('should calculate cost effectively with tiered 200K fallback pricing', async () => {
    // Mock 价格表：如果超过 200K tokens 则加收两倍费率
    vi.spyOn(modelPricingService, 'getPrice').mockResolvedValue({
      input: 5.0,
      output: 15.0,
      cacheRead: 0,
      cacheWrite: 0,
      over200K: {
        input: 10.0,
        output: 30.0,
        cacheRead: 0,
        cacheWrite: 0
      }
    });

    // 小于 200K: 100k input = 0.5 USD, 100k output = 1.5 USD => Total 2.0
    const normalCost = await modelPricingService.calculateCost('mock', 'gpt-4o', 100_000, 100_000);
    expect(normalCost).toBe(2.0);

    // 大于 200K: 300k input = 3.0 USD, 100k output = 3.0 USD => Total 6.0
    const overflowCost = await modelPricingService.calculateCost('mock', 'gpt-4o', 300_000, 100_000);
    expect(overflowCost).toBe(6.0);
  });

  it('should return null if price cannot be fetched for a completely unknown provider', async () => {
    vi.spyOn(modelPricingService, 'getPrice').mockResolvedValue(null);
    const cost = await modelPricingService.calculateCost('unknown', 'unknown', 5000, 1000);
    expect(cost).toBeNull();
  });
});
