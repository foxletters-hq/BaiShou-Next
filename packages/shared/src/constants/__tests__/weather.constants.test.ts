import { describe, expect, it } from 'vitest'
import {
  expandWeatherFilterValues,
  normalizeWeatherId,
  weatherMatchesFilter
} from '../weather.constants'

describe('weather.constants', () => {
  it('normalizes legacy Chinese labels to canonical ids', () => {
    expect(normalizeWeatherId('晴')).toBe('sunny')
    expect(normalizeWeatherId('风')).toBe('windy')
    expect(normalizeWeatherId('sunny')).toBe('sunny')
  })

  it('expands filter ids to include legacy stored values', () => {
    const expanded = expandWeatherFilterValues(['sunny'])
    expect(expanded).toContain('sunny')
    expect(expanded).toContain('晴')
  })

  it('matches diary weather stored as Chinese when filtering by canonical id', () => {
    expect(weatherMatchesFilter('晴', ['sunny'])).toBe(true)
    expect(weatherMatchesFilter('sunny', ['sunny'])).toBe(true)
    expect(weatherMatchesFilter('多云', ['cloudy'])).toBe(true)
    expect(weatherMatchesFilter('晴', ['cloudy'])).toBe(false)
  })
})
