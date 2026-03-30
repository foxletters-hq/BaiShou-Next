/**
 * 模型定价服务
 *
 * 从 models.dev 获取公开的模型价格表，计算 token 费用。
 * 支持 200K+ 上下文的阶梯价格。
 *
 * 原始实现：lib/agent/pricing/model_pricing_service.dart (165 行)
 */

// ─── 类型定义 ──────────────────────────────────────────────

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

export interface ModelPrice {
  /** 美元 / 百万 token */
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  /** 200K+ 上下文的阶梯价格 */
  over200K?: ModelPrice;
}

// ─── 费用计算 ──────────────────────────────────────────────

/**
 * 根据 token 用量计算费用（美元）
 * 自动判断是否使用 200K+ 阶梯价
 */
export function calculateTokenCost(
  price: ModelPrice,
  usage: TokenUsage,
): number {
  const totalInput = usage.inputTokens + (usage.cachedInputTokens ?? 0);

  // 如果有 200K+ 阶梯价且总输入超过 200K，使用阶梯价
  const effectivePrice =
    price.over200K && totalInput > 200_000 ? price.over200K : price;

  const inputCost = (usage.inputTokens * effectivePrice.input) / 1_000_000;
  const outputCost = (usage.outputTokens * effectivePrice.output) / 1_000_000;
  const cacheCost =
    ((usage.cachedInputTokens ?? 0) * effectivePrice.cacheRead) / 1_000_000;

  return inputCost + outputCost + cacheCost;
}

// ─── 定价服务（单例） ──────────────────────────────────────

export class ModelPricingService {
  private readonly prices = new Map<string, ModelPrice>();
  private lastFetchTime: Date | null = null;

  /** 缓存有效期 1 小时 */
  private static readonly CACHE_DURATION_MS = 60 * 60 * 1000;

  /**
   * 获取模型价格
   */
  async getPrice(
    providerId: string,
    modelId: string,
  ): Promise<ModelPrice | null> {
    await this.ensureLoaded();

    // 先精确匹配
    const key = `${providerId}/${modelId}`;
    const exact = this.prices.get(key);
    if (exact) return exact;

    // 再尝试仅 modelId 匹配（用户可能用自定义 provider）
    for (const [k, v] of this.prices.entries()) {
      if (k.endsWith(`/${modelId}`)) return v;
    }

    return null;
  }

  /**
   * 快速计算费用（返回美元，获取失败返回 null）
   */
  async calculateCost(
    providerId: string,
    modelId: string,
    usage: TokenUsage,
  ): Promise<number | null> {
    const price = await this.getPrice(providerId, modelId);
    if (!price) return null;
    return calculateTokenCost(price, usage);
  }

  /**
   * 确保价格表已加载
   */
  private async ensureLoaded(): Promise<void> {
    if (
      this.prices.size > 0 &&
      this.lastFetchTime &&
      Date.now() - this.lastFetchTime.getTime() <
        ModelPricingService.CACHE_DURATION_MS
    ) {
      return;
    }
    await this.fetchPrices();
  }

  /**
   * 从 models.dev 拉取价格表
   */
  private async fetchPrices(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch('https://models.dev/api.json', {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) return;

      const data = (await response.json()) as Record<
        string,
        { models?: Record<string, { cost?: Record<string, unknown> }> }
      >;

      this.prices.clear();

      for (const [providerId, provider] of Object.entries(data)) {
        if (!provider?.models) continue;

        for (const [modelId, model] of Object.entries(provider.models)) {
          if (!model?.cost) continue;
          const cost = model.cost;

          const inputPrice = Number(cost['input'] ?? 0);
          if (inputPrice === 0) continue; // 跳过免费/未知模型

          // 解析 200K+ 阶梯价
          const over200KData = cost['context_over_200k'] as
            | Record<string, unknown>
            | undefined;
          let over200K: ModelPrice | undefined;
          if (over200KData) {
            over200K = {
              input: Number(over200KData['input'] ?? inputPrice),
              output: Number(
                over200KData['output'] ?? cost['output'] ?? 0,
              ),
              cacheRead: Number(over200KData['cache_read'] ?? 0),
              cacheWrite: Number(over200KData['cache_write'] ?? 0),
            };
          }

          this.prices.set(`${providerId}/${modelId}`, {
            input: inputPrice,
            output: Number(cost['output'] ?? 0),
            cacheRead: Number(cost['cache_read'] ?? 0),
            cacheWrite: Number(cost['cache_write'] ?? 0),
            over200K,
          });
        }
      }

      this.lastFetchTime = new Date();
    } catch {
      // 获取失败不阻塞主流程
    }
  }
}

/** 全局单例 */
export const modelPricingService = new ModelPricingService();
