import { describe, expect, it } from 'vitest'
import { isServerFixedTemperatureModel, resolveTemperatureForModel } from '../model-temperature'

describe('isServerFixedTemperatureModel', () => {
  it('marks Kimi models whose sampling params are server-fixed', () => {
    expect(isServerFixedTemperatureModel('kimi-k3')).toBe(true)
    expect(isServerFixedTemperatureModel('kimi-k3-fast')).toBe(true)
    expect(isServerFixedTemperatureModel('moonshotai/kimi-k3')).toBe(true)
    expect(isServerFixedTemperatureModel('kimi-k2.6')).toBe(true)
    expect(isServerFixedTemperatureModel('kimi-k2.7-code')).toBe(true)
    expect(isServerFixedTemperatureModel('kimi-for-coding')).toBe(true)
  })

  it('marks Kimi provider short aliases', () => {
    expect(isServerFixedTemperatureModel('k3-256k')).toBe(true)
    expect(isServerFixedTemperatureModel('k2p5')).toBe(true)
  })

  it('keeps temperature configurable for non-Kimi models', () => {
    expect(isServerFixedTemperatureModel('moonshot-v1-8k')).toBe(false)
    expect(isServerFixedTemperatureModel('gpt-5.6-sol')).toBe(false)
    expect(isServerFixedTemperatureModel('deepseek-v4-pro')).toBe(false)
    expect(isServerFixedTemperatureModel('')).toBe(false)
  })
})

describe('resolveTemperatureForModel', () => {
  it('omits temperature for server-fixed models', () => {
    expect(resolveTemperatureForModel('kimi-k3', 0.1)).toBeUndefined()
    expect(resolveTemperatureForModel('moonshotai/kimi-k3', 0)).toBeUndefined()
  })

  it('keeps the desired temperature for other models', () => {
    expect(resolveTemperatureForModel('moonshot-v1-8k', 0.1)).toBe(0.1)
    expect(resolveTemperatureForModel('gpt-5.6-sol', 0.1)).toBe(0.1)
  })
})
