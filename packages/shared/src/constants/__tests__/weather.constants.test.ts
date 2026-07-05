import { describe, expect, it } from 'vitest'
import {
  expandWeatherFilterValues,
  normalizeWeatherId,
  resolveWeatherId,
  weatherMatchesFilter
} from '../weather.constants'

describe('weather.constants', () => {
  it('normalizes English aliases to canonical ids', () => {
    expect(normalizeWeatherId('wind')).toBe('windy')
    expect(normalizeWeatherId('sunny')).toBe('sunny')
  })

  it('normalizes legacy Chinese labels to canonical ids', () => {
    expect(normalizeWeatherId('晴')).toBe('sunny')
    expect(normalizeWeatherId('多云')).toBe('cloudy')
    expect(normalizeWeatherId('小雨')).toBe('light_rain')
    expect(normalizeWeatherId('晴转多云')).toBe('cloudy')
    expect(normalizeWeatherId('微风')).toBe('windy')
  })

  it('resolveWeatherId returns null for unknown values', () => {
    expect(resolveWeatherId('sunny')).toBe('sunny')
    expect(resolveWeatherId('晴')).toBe('sunny')
    expect(resolveWeatherId('unknown')).toBeNull()
  })

  it('expands filter ids to canonical values', () => {
    const expanded = expandWeatherFilterValues(['sunny', 'wind'])
    expect(expanded).toContain('sunny')
    expect(expanded).toContain('wind')
    expect(expanded).toContain('windy')
  })

  it('matches diary weather by canonical id', () => {
    expect(weatherMatchesFilter('sunny', ['sunny'])).toBe(true)
    expect(weatherMatchesFilter('cloudy', ['cloudy'])).toBe(true)
    expect(weatherMatchesFilter('sunny', ['cloudy'])).toBe(false)
  })
})
