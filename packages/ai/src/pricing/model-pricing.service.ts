/**
 * ModelPricingService - 动态阶梯模型计价器
 * 从 models.dev 拉取模型最新牌价，对 200k 上下文具备自动阶梯跃升探测。
 * 返回微美分 (costMicros)。
 */

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

export class ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  over200K?: ModelPrice;

  constructor(data: {
    input: number;
    output: number;
    cacheRead?: number;
    cacheWrite?: number;
    over200K?: ModelPrice;
  }) {
    this.input = data.input;
    this.output = data.output;
    this.cacheRead = data.cacheRead || 0;
    this.cacheWrite = data.cacheWrite || 0;
    this.over200K = data.over200K;
  }

  /**
   * 计算美元级总费用
   */
  public calculateCost(usage: TokenUsage): number {
    const totalInput = usage.inputTokens + (usage.cachedInputTokens || 0);
    const effectivePrice = (this.over200K && totalInput > 200000) ? this.over200K : this;

    const inputCost = (usage.inputTokens * effectivePrice.input) / 1000000;
    const outputCost = (usage.outputTokens * effectivePrice.output) / 1000000;
    const cacheCost = ((usage.cachedInputTokens || 0) * effectivePrice.cacheRead) / 1000000;

    return inputCost + outputCost + cacheCost;
  }
}

export class ModelPricingService {
  private static instance: ModelPricingService;
  private prices: Map<string, ModelPrice> = new Map();
  private lastFetchTime?: Date;
  private readonly CACHE_DURATION_MS = 60 * 60 * 1000; // 1小时缓存失效

  private constructor() {}

  public static getInstance(): ModelPricingService {
    if (!ModelPricingService.instance) {
      ModelPricingService.instance = new ModelPricingService();
    }
    return ModelPricingService.instance;
  }

  /**
   * 自动加载或缓存匹配获取价格实体
   */
  public async getPrice(providerId: string, modelId: string): Promise<ModelPrice | null> {
    await this.ensureLoaded();

    const preciseKey = `${providerId}/${modelId}`;
    if (this.prices.has(preciseKey)) return this.prices.get(preciseKey)!;

    // 退而求其次，如果有只匹配 modelId 的（某些自定义或白牌 Provider 映射但名字一样的情形）
    for (const [key, value] of this.prices.entries()) {
      if (key.endsWith(`/${modelId}`)) return value;
    }
    return null;
  }

  /**
   * 直接进行微美分 (Micros) 计算，用于白守数据库录入的统一单位 (1 USD = 1,000,000 micros)
   * 若无法捕获牌价则默认返回 0。
   */
  public async calculateCostMicros(
    providerId: string,
    modelId: string,
    usage: TokenUsage
  ): Promise<number> {
    const price = await this.getPrice(providerId, modelId);
    if (!price) return 0;
    
    const costInUSD = price.calculateCost(usage);
    return Math.round(costInUSD * 1000000); // 转成 Micros 并确保是整数存入 Int 表
  }

  private async ensureLoaded() {
    if (
      this.prices.size > 0 &&
      this.lastFetchTime &&
      (new Date().getTime() - this.lastFetchTime.getTime() < this.CACHE_DURATION_MS)
    ) {
      return;
    }
    await this.fetchPrices();
  }

  private async fetchPrices() {
    try {
      // 引入超时机制保护网络断开情况下的运行阻塞 (AbortSignal Timeout)
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('https://models.dev/api.json', { signal: controller.signal });
      clearTimeout(id);

      if (!response.ok) {
        console.warn(`[ModelPricingService] models.dev returned HTTP ${response.status}`);
        return;
      }

      const data = await response.json();
      this.prices.clear();

      for (const providerId of Object.keys(data)) {
        const providerData = data[providerId];
        const modelsData = providerData?.models;
        if (!modelsData) continue;

        for (const modelId of Object.keys(modelsData)) {
          const model = modelsData[modelId];
          const costData = model?.cost;
          if (!costData) continue;

          const inputPrice = costData.input ?? 0;
          if (inputPrice === 0) continue; // 跨过纯免费不计的模型

          const over200k = costData.context_over_200k;
          let over200kPriceObj: ModelPrice | undefined;

          if (over200k) {
             over200kPriceObj = new ModelPrice({
                input: over200k.input ?? inputPrice,
                output: over200k.output ?? costData.output ?? 0,
                cacheRead: over200k.cache_read ?? 0,
                cacheWrite: over200k.cache_write ?? 0
             });
          }

          this.prices.set(`${providerId}/${modelId}`, new ModelPrice({
             input: inputPrice,
             output: costData.output ?? 0,
             cacheRead: costData.cache_read ?? 0,
             cacheWrite: costData.cache_write ?? 0,
             over200K: over200kPriceObj
          }));
        }
      }

      this.lastFetchTime = new Date();
    } catch (e) {
      console.warn('[ModelPricingService] prices fetch failed:', e);
      // 网络打不开没关系，失败的话大不了不扣钱，决不能让 Agent 崩溃停止回答
    }
  }
}
