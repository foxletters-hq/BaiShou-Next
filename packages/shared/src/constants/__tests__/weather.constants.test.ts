import { describe, expect, it } from 'vitest'
import {
  expandWeatherFilterValues,
  normalizeWeatherId,
  weatherMatchesFilter
} from '../weather.constants'

describe('weather.constants', () => {
  it('normalizes English aliases to canonical ids', () => {
    expect(normalizeWeatherId('wind')).toBe('windy')
    expect(normalizeWeatherId('sunny')).toBe('sunny')
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
