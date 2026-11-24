import { afterEach, describe, expect, it, vi } from 'vitest'
import { ModelPricingService } from '../pricing/model-pricing.service'

describe('ModelPricingService chunked yield and atomic refresh', () => {
  const originalCustomNetFetch = (globalThis as any).customNetFetch

  afterEach(() => {
    ;(globalThis as any).customNetFetch = originalCustomNetFetch
    vi.restoreAllMocks()
  })

  it('yields to event loop while parsing large catalog and keeps existing cache during refresh', async () => {
    const service = ModelPricingService.getInstance()

    const makeCatalog = (count: number, inputPrice: number) => {
      const payload: Record<string, any> = {}
      for (let i = 0; i < count; i += 1) {
        payload[`provider-${i}`] = {
          models: {
            [`model-${i}`]: {
              cost: {
                input: inputPrice,
                output: inputPrice * 2,
                context_over_200k: {
                  input: inputPrice * 3,
                  output: inputPrice * 4
                }
              }
            }
          }
        }
      }
      return payload
    }

    ;(globalThis as any).customNetFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeCatalog(2, 1)
    })
    await service.forceRefresh()
    expect(service.hasCachedPrices).toBe(true)

    let sawEmptyCacheMidRefresh = false
    let macrotaskTicksDuringRefresh = 0
    ;(globalThis as any).customNetFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeCatalog(35, 2)
    })

    const refreshPromise = service.forceRefresh()
    // 在刷新过程中挂载 macrotask 探针，确认刷新让出了事件循环且未中途清空缓存
    const probeDone = new Promise<void>((resolve) => {
      const tick = () => {
        macrotaskTicksDuringRefresh += 1
        if (!service.hasCachedPrices) {
          sawEmptyCacheMidRefresh = true
        }
        if (macrotaskTicksDuringRefresh >= 3) {
          resolve()
          return
        }
        setTimeout(tick, 0)
      }
      setTimeout(tick, 0)
    })

    await Promise.all([refreshPromise, probeDone])

    expect(sawEmptyCacheMidRefresh).toBe(false)
    expect(macrotaskTicksDuringRefresh).toBeGreaterThanOrEqual(3)
    const price = await service.getPrice('provider-34', 'model-34')
    expect(price).not.toBeNull()
    expect(price!.input).toBe(2)
    expect(price!.over200K?.input).toBe(6)
  })
})
