import { describe, expect, it } from 'vitest'
import {
  expandMoodFilterValues,
  moodMatchesFilter,
  normalizeMoodId,
  resolveMoodId
} from '../mood.constants'

describe('mood.constants', () => {
  it('normalizes English aliases to canonical ids', () => {
    expect(normalizeMoodId('happy')).toBe('Happy')
    expect(normalizeMoodId('calm')).toBe('Peaceful')
    expect(normalizeMoodId('Happy')).toBe('Happy')
  })

  it('normalizes legacy Chinese labels to canonical ids', () => {
    expect(normalizeMoodId('开心')).toBe('Happy')
    expect(normalizeMoodId('平静')).toBe('Peaceful')
    expect(normalizeMoodId('忧伤')).toBe('Melancholy')
  })

  it('resolveMoodId returns null for unknown values', () => {
    expect(resolveMoodId('Happy')).toBe('Happy')
    expect(resolveMoodId('开心')).toBe('Happy')
    expect(resolveMoodId('unknown')).toBeNull()
  })

  it('normalizes fallback emoji to canonical ids', () => {
    expect(normalizeMoodId('🙂')).toBe('Happy')
    expect(resolveMoodId('😌')).toBe('Peaceful')
  })

  it('expands filter ids to stored variants', () => {
    const expanded = expandMoodFilterValues(['Happy'])
    expect(expanded).toContain('Happy')
    expect(expanded).toContain('开心')
    expect(expanded).toContain('happy')
    expect(expanded).toContain('🙂')
  })

  it('matches diary mood by canonical id or legacy label', () => {
    expect(moodMatchesFilter('Happy', ['Happy'])).toBe(true)
    expect(moodMatchesFilter('开心', ['Happy'])).toBe(true)
    expect(moodMatchesFilter('🙂', ['Happy'])).toBe(true)
    expect(moodMatchesFilter('Happy', ['Peaceful'])).toBe(false)
  })
})
