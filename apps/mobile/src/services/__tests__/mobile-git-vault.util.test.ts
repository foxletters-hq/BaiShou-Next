import { describe, expect, it } from 'vitest'
import { isMobileGitHttpRemote, mobileGitUnsupportedAction } from '../mobile-git-vault.util'

describe('mobile git remote probe', () => {
  it('should accept https remotes', () => {
    expect(isMobileGitHttpRemote('https://example.com/repo.git')).toBe(true)
  })

  it('should reject ssh remotes on mobile probe', () => {
    expect(isMobileGitHttpRemote('git@example.com:repo.git')).toBe(false)
  })

  it('should reject commit on mobile without a git cli', () => {
    expect(() => mobileGitUnsupportedAction()).toThrow(/桌面端/)
  })
})
