import { afterEach, describe, expect, it } from 'vitest'
import {
  readExpandedPreference,
  writeExpandedPreference
} from '../workbench-home-sidebar-expand.util'

const STORAGE_KEY = 'baishou:workbench-home-recent-expanded'

describe('workbench-home-sidebar-expand.util', () => {
  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY)
  })

  it('should treat a missing preference as expanded', () => {
    expect(readExpandedPreference()).toBe(true)
  })

  it('should persist and restore the collapsed preference', () => {
    writeExpandedPreference(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('0')
    expect(readExpandedPreference()).toBe(false)
    writeExpandedPreference(true)
    expect(readExpandedPreference()).toBe(true)
  })
})
