export interface ModelPrice {
  input: number; // USD per 1M tokens
  output: number; // USD per 1M tokens
  cacheRead: number; // USD per 1M tokens
  cacheWrite: number; // USD per 1M tokens
  over200K?: ModelPrice; // Tiered pricing for 200k+ inputs
}

export class ModelPricingService {
  private prices: Map<string, ModelPrice> = new Map();
  private lastFetchTime?: Date;
  private readonly cacheDuration = 60 * 60 * 1000; // 1 hour

  /**
   * 确保从远端 models.dev 获取最新的汇率表并写入内存
   */
  public async ensureLoaded(): Promise<void> {
    if (this.prices.size > 0 && this.lastFetchTime && (Date.now() - this.lastFetchTime.getTime() < this.cacheDuration)) {
      return;
    }
    await this.fetchPrices();
  }

  /**
   * 抓取公开模型价格清单
   */
  private async fetchPrices(): Promise<void> {
    try {
      const res = await fetch('https://models.dev/api.json', { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return;
      const data = await res.json();
      
      this.prices.clear();
      for (const [providerId, provider] of Object.entries<any>(data)) {
        if (!provider.models) continue;
        for (const [modelId, model] of Object.entries<any>(provider.models)) {
          if (!model.cost) continue;
          
          const cost = model.cost;
          const inputPrice = parseFloat(cost.input) || 0;
          if (inputPrice === 0) continue;
          
          let over200K: ModelPrice | undefined;
          if (cost.context_over_200k) {
            over200K = {
              input: parseFloat(cost.context_over_200k.input) || inputPrice,
              output: parseFloat(cost.context_over_200k.output) || parseFloat(cost.output) || 0,
              cacheRead: parseFloat(cost.context_over_200k.cache_read) || 0,
              cacheWrite: parseFloat(cost.context_over_200k.cache_write) || 0,
            };
          }
          
          this.prices.set(`${providerId}/${modelId}`, {
            input: inputPrice,
            output: parseFloat(cost.output) || 0,
            cacheRead: parseFloat(cost.cache_read) || 0,
            cacheWrite: parseFloat(cost.cache_write) || 0,
            over200K
          });
        }
      }
      this.lastFetchTime = new Date();
    } catch (e) {
      console.warn('[ModelPricingService] fetch failed, will fallback to null cost', e);
    }
  }

  /**
   * 获取特定模型的汇率，支持使用 Provider 隔离或者兜底检索
   */
  public async getPrice(providerId: string, modelId: string): Promise<ModelPrice | null> {
    await this.ensureLoaded();
    const exactKey = `${providerId}/${modelId}`;
    if (this.prices.has(exactKey)) return this.prices.get(exactKey)!;
    
    // 如果没有找到带供应商的，尝试仅匹配 modelId (应对自定义供应商使用共有模型的情况)
    for (const [k, v] of this.prices.entries()) {
      if (k.endsWith(`/${modelId}`)) return v;
    }
    return null;
  }

  /**
   * 核心计量算法，复原 Flutter 老版关于 over200k 阶梯价的双阈值切片
   */
  public async calculateCost(
    providerId: string, 
    modelId: string, 
    inputTokens: number, 
    outputTokens: number, 
    cachedInputTokens: number = 0
  ): Promise<number | null> {
    const price = await this.getPrice(providerId, modelId);
    if (!price) return null;
    
    const totalInput = inputTokens + cachedInputTokens;
    // 当输入池超过 20w Token 开启阶梯定价
    const effectivePrice = (price.over200K && totalInput > 200000) ? price.over200K : price;
    
    const inputCost = (inputTokens / 1_000_000) * effectivePrice.input;
    const outputCost = (outputTokens / 1_000_000) * effectivePrice.output;
    const cacheCost = (cachedInputTokens / 1_000_000) * effectivePrice.cacheRead;
    
    return inputCost + outputCost + cacheCost;
  }
}

export const modelPricingService = new ModelPricingService();

/**
 * 美金转换为数据库长期存储使用的微单位 (Micro-cents)
 * 解决 SQLite 浮点数漂移的问题。
 */
export function usdToMicros(usd: number): number {
  return Math.round(usd * 1_000_000);
}

/**
 * 微单位 (Micro-cents) 转回美金格式，用于 UI 展示。
 */
export function microsToUsd(micros: number): number {
  return micros / 1_000_000;
}
