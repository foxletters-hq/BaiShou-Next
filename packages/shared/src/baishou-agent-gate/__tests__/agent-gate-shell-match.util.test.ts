import { describe, expect, it } from 'vitest'
import {
  allowlistEntryMatches,
  isDangerousShellCommand,
  matchShellCommandPattern,
  resolveCommandPrefixPattern,
  tokenizeCommand
} from '../agent-gate-shell-match.util'

describe('tokenizeCommand', () => {
  it('splits argv and strips simple quotes', () => {
    expect(tokenizeCommand('git status -sb')).toEqual(['git', 'status', '-sb'])
    expect(tokenizeCommand('echo "hello world"')).toEqual(['echo', 'hello world'])
  })
})

describe('resolveCommandPrefixPattern', () => {
  it('uses arity table for git/npm', () => {
    expect(resolveCommandPrefixPattern(['git', 'status', '-sb'])).toBe('git status *')
    expect(resolveCommandPrefixPattern(['npm', 'run', 'build'])).toBe('npm run *')
    expect(resolveCommandPrefixPattern(['rm', '-rf', 'dist'])).toBe('rm *')
  })
})

describe('matchShellCommandPattern', () => {
  it('matches prefix with wildcard and rejects different subcommands', () => {
    expect(matchShellCommandPattern('git status -sb', 'git status *')).toBe(true)
    expect(matchShellCommandPattern('git push origin main', 'git status *')).toBe(false)
  })

  it('never matches by raw substring', () => {
    expect(matchShellCommandPattern('echo harmless', 'rm *')).toBe(false)
    expect(matchShellCommandPattern('harmless', 'rm')).toBe(false)
  })
})

describe('isDangerousShellCommand', () => {
  it('flags recursive delete and disk wipe families', () => {
    expect(isDangerousShellCommand('rm -rf /')).toBe(true)
    expect(isDangerousShellCommand('del /s C:\\temp')).toBe(true)
    expect(isDangerousShellCommand('git status')).toBe(false)
  })
})

describe('allowlistEntryMatches', () => {
  it('legacy action-only entry matches any resources', () => {
    expect(
      allowlistEntryMatches(
        { action: 'workspace_run' },
        {
          action: 'workspace_run',
          resources: [{ kind: 'shell_command', value: 'git status' }]
        }
      )
    ).toBe(true)
  })

  it('pattern entry requires shell_command match', () => {
    const entry = {
      action: 'workspace_run',
      pattern: 'git status *',
      resourceKind: 'shell_command'
    }
    expect(
      allowlistEntryMatches(entry, {
        action: 'workspace_run',
        resources: [{ kind: 'shell_command', value: 'git status -sb' }]
      })
    ).toBe(true)
    expect(
      allowlistEntryMatches(entry, {
        action: 'workspace_run',
        resources: [{ kind: 'shell_command', value: 'git push' }]
      })
    ).toBe(false)
  })
})
