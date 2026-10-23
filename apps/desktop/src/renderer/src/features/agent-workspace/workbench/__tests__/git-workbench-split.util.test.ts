import { afterEach, describe, expect, it } from 'vitest'
import {
  GIT_SPLIT_DEFAULT,
  GIT_SPLIT_STORAGE_KEY,
  clampGitSplitRatio,
  loadGitSplitRatio,
  nextGitSplitRatio,
  persistGitSplitRatio
} from '../git-workbench-split.util'

describe('clampGitSplitRatio', () => {
  it('keeps values inside the allowed range', () => {
    expect(clampGitSplitRatio(0.5)).toBe(0.5)
    expect(clampGitSplitRatio(0.01)).toBe(0.22)
    expect(clampGitSplitRatio(0.99)).toBe(0.78)
    expect(clampGitSplitRatio(Number.NaN)).toBe(GIT_SPLIT_DEFAULT)
  })
})

describe('nextGitSplitRatio', () => {
  it('moves the split by the pointer delta relative to the container', () => {
    expect(nextGitSplitRatio(0.5, 200, 40)).toBe(0.7)
    expect(nextGitSplitRatio(0.5, 200, -80)).toBe(0.22)
    expect(nextGitSplitRatio(0.5, 0, 40)).toBe(0.5)
  })
})

describe('git split persistence', () => {
  afterEach(() => {
    localStorage.removeItem(GIT_SPLIT_STORAGE_KEY)
  })

  it('reads the stored ratio and falls back when missing', () => {
    expect(loadGitSplitRatio()).toBe(GIT_SPLIT_DEFAULT)
    persistGitSplitRatio(0.61)
    expect(loadGitSplitRatio()).toBe(0.61)
  })
})
