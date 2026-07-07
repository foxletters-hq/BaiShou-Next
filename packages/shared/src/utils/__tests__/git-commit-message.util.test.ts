import { describe, expect, it } from 'vitest'
import {
  formatDefaultGitCommitMessage,
  resolveGitCommitMessage
} from '../git-commit-message.util'

describe('git-commit-message.util', () => {
  const fixedDate = new Date(2026, 6, 3, 14, 5, 9)

  it('formatDefaultGitCommitMessage uses local date and time with seconds', () => {
    expect(formatDefaultGitCommitMessage(fixedDate)).toBe('2026-07-03 14:05:09')
  })

  it('resolveGitCommitMessage keeps non-empty trimmed message', () => {
    expect(resolveGitCommitMessage('  fix typo  ', fixedDate)).toBe('fix typo')
  })

  it('resolveGitCommitMessage falls back when empty', () => {
    expect(resolveGitCommitMessage('   ', fixedDate)).toBe('2026-07-03 14:05:09')
    expect(resolveGitCommitMessage('', fixedDate)).toBe('2026-07-03 14:05:09')
  })
})
