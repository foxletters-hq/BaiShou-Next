import { describe, expect, it } from 'vitest'
import {
  applyDeepSeekPeakCost,
  deepSeekPeakCostMultiplier,
  isDeepSeekOfficialProvider,
  isDeepSeekPeakHour
} from '../deepseek-peak-pricing'

describe('isDeepSeekOfficialProvider', () => {
  it('should accept only the official provider id', () => {
    expect(isDeepSeekOfficialProvider('deepseek')).toBe(true)
    expect(isDeepSeekOfficialProvider('DeepSeek')).toBe(true)
    expect(isDeepSeekOfficialProvider('siliconflow')).toBe(false)
    expect(isDeepSeekOfficialProvider('deepseek-custom')).toBe(false)
  })
})

describe('isDeepSeekPeakHour', () => {
  it('should treat weekday 09:00 Beijing time as peak', () => {
    expect(isDeepSeekPeakHour(new Date('2026-08-27T01:00:00.000Z'))).toBe(true)
  })

  it('should treat weekday 12:00 Beijing time as off-peak', () => {
    expect(isDeepSeekPeakHour(new Date('2026-08-27T04:00:00.000Z'))).toBe(false)
  })

  it('should treat weekday 14:00 Beijing time as peak', () => {
    expect(isDeepSeekPeakHour(new Date('2026-08-27T06:00:00.000Z'))).toBe(true)
  })

  it('should treat weekday 18:00 Beijing time as off-peak', () => {
    expect(isDeepSeekPeakHour(new Date('2026-08-27T10:00:00.000Z'))).toBe(false)
  })

  it('should treat Saturday in Beijing as off-peak', () => {
    expect(isDeepSeekPeakHour(new Date('2026-08-29T01:00:00.000Z'))).toBe(false)
  })

  it('should treat Sunday in Beijing as off-peak', () => {
    expect(isDeepSeekPeakHour(new Date('2026-08-30T06:00:00.000Z'))).toBe(false)
  })
})

describe('deepSeekPeakCostMultiplier', () => {
  it('should return 2 for official DeepSeek during peak hours', () => {
    expect(deepSeekPeakCostMultiplier('deepseek', new Date('2026-08-27T01:00:00.000Z'))).toBe(2)
  })

  it('should return 1 for official DeepSeek during off-peak hours', () => {
    expect(deepSeekPeakCostMultiplier('deepseek', new Date('2026-08-27T04:00:00.000Z'))).toBe(1)
  })

  it('should return 1 for other providers during peak hours', () => {
    expect(deepSeekPeakCostMultiplier('openai', new Date('2026-08-27T01:00:00.000Z'))).toBe(1)
  })
})

describe('applyDeepSeekPeakCost', () => {
  it('should double the catalog cost for DeepSeek in peak hours', () => {
    expect(applyDeepSeekPeakCost('deepseek', 0.15, new Date('2026-08-27T01:00:00.000Z'))).toBe(0.3)
  })

  it('should keep the catalog cost for DeepSeek in off-peak hours', () => {
    expect(applyDeepSeekPeakCost('deepseek', 0.15, new Date('2026-08-27T04:00:00.000Z'))).toBe(0.15)
  })
})
