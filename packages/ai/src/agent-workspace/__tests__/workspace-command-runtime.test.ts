import { describe, expect, it } from 'vitest'
import {
  buildWorkspaceRunToolDescription,
  detectWorkspaceCommandRuntime,
  planWorkspaceCommandSpawn
} from '../workspace-command-runtime'

describe('detectWorkspaceCommandRuntime', () => {
  it('should prefer PowerShell Core then Windows PowerShell then Git Unix layer then console on win32', () => {
    expect(
      detectWorkspaceCommandRuntime({
        platform: 'win32',
        env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
        locate: (name) => (name === 'pwsh' ? 'C:\\pwsh\\pwsh.exe' : undefined),
        exists: (file) => file === 'C:\\pwsh\\pwsh.exe' || file === 'C:\\Windows\\System32\\cmd.exe'
      }).family
    ).toBe('win_pwsh')

    expect(
      detectWorkspaceCommandRuntime({
        platform: 'win32',
        env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
        locate: (name) =>
          name === 'powershell'
            ? 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
            : undefined,
        exists: (file) =>
          file.includes('powershell.exe') || file === 'C:\\Windows\\System32\\cmd.exe'
      }).family
    ).toBe('win_powershell')

    expect(
      detectWorkspaceCommandRuntime({
        platform: 'win32',
        env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
        locate: () => undefined,
        exists: (file) => file === 'C:\\Windows\\System32\\cmd.exe'
      })
    ).toMatchObject({ family: 'win_console', binary: 'cmd' })
  })

  it('should resolve Git Unix layer from git.exe on win32', () => {
    const git = 'C:\\Program Files\\Git\\cmd\\git.exe'
    const bash = 'C:\\Program Files\\Git\\bin\\bash.exe'
    const runtime = detectWorkspaceCommandRuntime({
      platform: 'win32',
      env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
      locate: (name) => (name === 'git' ? git : undefined),
      exists: (file) => file === bash || file === git || file === 'C:\\Windows\\System32\\cmd.exe'
    })
    expect(runtime).toMatchObject({ executable: bash, family: 'unix_shell', binary: 'bash' })
  })

  it('should allow test override without exposing a user setting', () => {
    const runtime = detectWorkspaceCommandRuntime({
      platform: 'win32',
      override: 'cmd',
      env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
      locate: (name) => {
        if (name === 'pwsh') return 'C:\\pwsh\\pwsh.exe'
        if (name === 'cmd') return 'C:\\Windows\\System32\\cmd.exe'
        return undefined
      },
      exists: () => true
    })
    expect(runtime.family).toBe('win_console')
  })

  it('should skip fish and fall back to bash or sh', () => {
    const runtime = detectWorkspaceCommandRuntime({
      platform: 'linux',
      env: { SHELL: '/usr/bin/fish' },
      locate: (name) => (name === 'bash' ? '/usr/bin/bash' : undefined),
      exists: (file) => file === '/usr/bin/fish' || file === '/usr/bin/bash'
    })
    expect(runtime).toMatchObject({ executable: '/usr/bin/bash', family: 'unix_shell', binary: 'bash' })
  })

  it('should use /bin/zsh on darwin when present', () => {
    const runtime = detectWorkspaceCommandRuntime({
      platform: 'darwin',
      locate: () => undefined,
      exists: (file) => file === '/bin/zsh'
    })
    expect(runtime).toMatchObject({ executable: '/bin/zsh', binary: 'zsh', family: 'unix_shell' })
  })
})

describe('planWorkspaceCommandSpawn / buildWorkspaceRunToolDescription', () => {
  it('should start PowerShell Core with -Command and not attach the Windows console', () => {
    const spawn = planWorkspaceCommandSpawn(
      {
        executable: 'C:\\pwsh\\pwsh.exe',
        binary: 'pwsh',
        family: 'win_pwsh',
        label: 'PowerShell Core'
      },
      'mkdir foo'
    )
    expect(spawn.attachRuntimeAsShell).toBe(false)
    expect(spawn.file).toBe('C:\\pwsh\\pwsh.exe')
    expect(spawn.args).toEqual(['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', 'mkdir foo'])
  })

  it('should name the command environment and ask for the inner command only', () => {
    const text = buildWorkspaceRunToolDescription(
      {
        executable: 'cmd.exe',
        binary: 'cmd',
        family: 'win_console',
        label: 'Windows console'
      },
      'win32'
    )
    expect(text).toContain('Windows console')
    expect(text).toContain('inner command')
    expect(text).toContain('cmd /c')
  })
})
