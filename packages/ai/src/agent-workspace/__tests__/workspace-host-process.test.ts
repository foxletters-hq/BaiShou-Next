import { describe, it, expect } from 'vitest'
// @ts-ignore - Node built-in, available at runtime
import { mkdtempSync } from 'node:fs'
// @ts-ignore - Node built-in, available at runtime
import { tmpdir } from 'node:os'
// @ts-ignore - Node built-in, available at runtime
import { join } from 'node:path'
import { detectProcessCommandRuntime, runHostProcess } from '../workspace-host-process'

describe('runHostProcess', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'baishou-workspace-run-'))

  it('runs a simple node command and captures stdout', async () => {
    const result = await runHostProcess({
      command: `node -e "console.log('ok')"`,
      cwd,
      timeoutMs: 30_000
    })

    expect(result.timedOut).toBe(false)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('ok')
    expect(result.truncated).toBe(false)
  })

  it('marks timedOut when the command exceeds timeout', async () => {
    const runtime = detectProcessCommandRuntime()
    const hang =
      runtime.family === 'win_powershell' || runtime.family === 'win_pwsh'
        ? 'Start-Sleep -Seconds 30'
        : process.platform === 'win32'
          ? 'ping -n 30 127.0.0.1 >nul'
          : 'sleep 30'

    const result = await runHostProcess({
      command: hang,
      cwd,
      timeoutMs: 500
    })

    expect(result.timedOut).toBe(true)
    expect(result.exitCode).toBeNull()
  }, 15_000)

  it('respects abortSignal before start', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await runHostProcess({
      command: `node -e "console.log('nope')"`,
      cwd,
      abortSignal: controller.signal
    })
    expect(result.output).toContain('aborted')
    expect(result.exitCode).toBeNull()
  })
})
