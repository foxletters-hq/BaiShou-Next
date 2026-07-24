import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  executeCommand,
  getCommand,
  registerCommand,
  resetCommandRegistryForTests
} from '../command-registry'

describe('command-registry', () => {
  beforeEach(() => {
    resetCommandRegistryForTests()
  })

  it('should return registered command when getCommand', () => {
    registerCommand({
      id: 'test.ping',
      labelKey: 'test.ping',
      defaultLabel: 'Ping',
      run: () => undefined
    })

    expect(getCommand('test.ping')?.defaultLabel).toBe('Ping')
  })

  it('should execute registered command when executeCommand', async () => {
    const run = vi.fn()
    registerCommand({
      id: 'test.run',
      labelKey: 'test.run',
      defaultLabel: 'Run',
      run
    })

    await executeCommand('test.run', { value: 1 })

    expect(run).toHaveBeenCalledWith({ value: 1 })
  })

  it('should throw when executeCommand with unknown id', async () => {
    await expect(executeCommand('missing', {})).rejects.toThrow('Unknown editor command: missing')
  })

  it('should skip run when isEnabled returns false', async () => {
    const run = vi.fn()
    registerCommand({
      id: 'test.disabled',
      labelKey: 'test.disabled',
      defaultLabel: 'Disabled',
      isEnabled: () => false,
      run
    })

    await executeCommand('test.disabled', {})

    expect(run).not.toHaveBeenCalled()
  })
})
