import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  applyGitProcessEnv,
  configureGitBinaryProvider,
  getBundledGitBinary,
  getBundledGitSpawnEnv
} from '../git-binary.registry'

describe('git-binary.registry', () => {
  beforeEach(() => {
    configureGitBinaryProvider({
      getBinary: () => 'git',
      getSpawnEnv: (extra = {}) => ({
        env: { ...process.env, ...extra },
        gitBinary: 'git'
      })
    })
  })

  it('uses configured binary provider', () => {
    configureGitBinaryProvider({
      getBinary: () => '/embedded/git',
      getSpawnEnv: () => ({ env: { LC_ALL: 'C.UTF-8' }, gitBinary: '/embedded/git' })
    })

    expect(getBundledGitBinary()).toBe('/embedded/git')
    expect(getBundledGitSpawnEnv({ FOO: 'bar' })).toEqual({
      env: { LC_ALL: 'C.UTF-8' },
      gitBinary: '/embedded/git'
    })
  })

  it('applies process env only once', () => {
    const applyProcessEnv = vi.fn()
    configureGitBinaryProvider({
      getBinary: () => 'git',
      getSpawnEnv: () => ({ env: {}, gitBinary: 'git' }),
      applyProcessEnv
    })

    applyGitProcessEnv()
    applyGitProcessEnv()

    expect(applyProcessEnv).toHaveBeenCalledTimes(1)
  })
})
