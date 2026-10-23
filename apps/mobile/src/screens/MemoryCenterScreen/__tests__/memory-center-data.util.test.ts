import { describe, expect, it } from 'vitest'
import {
  firstSearchParam,
  normalizeMemoryCenterRagConfig,
  readActiveVaultSafely,
  resolveMemoryCenterTabParam
} from '../memory-center-data.util'

describe('readActiveVaultSafely', () => {
  it('should return the vault when getActiveVault returns an object', () => {
    const vault = { id: 'v1', name: 'Personal' }
    expect(
      readActiveVaultSafely({
        getActiveVault: () => vault
      })
    ).toEqual(vault)
  })

  it('should return null when getActiveVault returns null', () => {
    expect(
      readActiveVaultSafely({
        getActiveVault: () => null
      })
    ).toBeNull()
  })

  it('should return null when getActiveVault throws instead of chaining catch', () => {
    expect(
      readActiveVaultSafely({
        getActiveVault: () => {
          throw new Error('registry not ready')
        }
      })
    ).toBeNull()
  })
})

describe('normalizeMemoryCenterRagConfig', () => {
  it('should keep null when settings have not been loaded', () => {
    expect(normalizeMemoryCenterRagConfig(null)).toBeNull()
    expect(normalizeMemoryCenterRagConfig(undefined)).toBeNull()
  })

  it('should default missing ragEnabled to true', () => {
    expect(normalizeMemoryCenterRagConfig({})).toEqual({ ragEnabled: true })
    expect(normalizeMemoryCenterRagConfig({ ragEnabled: undefined })).toEqual({
      ragEnabled: true
    })
  })

  it('should keep an explicit false', () => {
    expect(normalizeMemoryCenterRagConfig({ ragEnabled: false })).toEqual({
      ragEnabled: false
    })
  })
})

describe('firstSearchParam', () => {
  it('should return the string when the param is a string', () => {
    expect(firstSearchParam('vectors')).toBe('vectors')
  })

  it('should return the first item when Expo Router passes an array', () => {
    expect(firstSearchParam(['graph', 'vectors'])).toBe('graph')
  })

  it('should return an empty string when the param is missing', () => {
    expect(firstSearchParam(undefined)).toBe('')
    expect(firstSearchParam([])).toBe('')
  })
})

describe('resolveMemoryCenterTabParam', () => {
  it('should accept a listed tab', () => {
    expect(resolveMemoryCenterTabParam('graph')).toBe('graph')
    expect(resolveMemoryCenterTabParam(['vectors'])).toBe('vectors')
  })

  it('should return null when the param is not a memory tab', () => {
    expect(resolveMemoryCenterTabParam('settings')).toBeNull()
    expect(resolveMemoryCenterTabParam(undefined)).toBeNull()
  })
})
