import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockBundledExtensions = vi.hoisted(() => ({
  'sqlite-vec': undefined as { libPath: string; entryPoint: string } | undefined
}))

vi.mock('expo-sqlite', () => ({
  bundledExtensions: mockBundledExtensions
}))

import { loadExpoSqliteVecExtension } from '../expo-sqlite-vec.loader'

describe('loadExpoSqliteVecExtension', () => {
  beforeEach(() => {
    mockBundledExtensions['sqlite-vec'] = undefined
  })

  it('returns false when loadExtensionAsync is missing', async () => {
    const result = await loadExpoSqliteVecExtension({
      execAsync: vi.fn(),
      withTransactionAsync: vi.fn(),
      closeAsync: vi.fn()
    })
    expect(result.loaded).toBe(false)
    expect(result.reason).toContain('loadExtensionAsync')
  })

  it('returns false when bundled extension is not packaged', async () => {
    const result = await loadExpoSqliteVecExtension({
      execAsync: vi.fn(),
      withTransactionAsync: vi.fn(),
      closeAsync: vi.fn(),
      loadExtensionAsync: vi.fn()
    })
    expect(result.loaded).toBe(false)
    expect(result.reason).toContain('withSQLiteVecExtension')
  })

  it('loads extension when bundled binary is available', async () => {
    mockBundledExtensions['sqlite-vec'] = {
      libPath: '/vec/lib',
      entryPoint: 'sqlite3_vec_init'
    }
    const loadExtensionAsync = vi.fn().mockResolvedValue(undefined)
    const result = await loadExpoSqliteVecExtension({
      execAsync: vi.fn(),
      withTransactionAsync: vi.fn(),
      closeAsync: vi.fn(),
      loadExtensionAsync
    })
    expect(result.loaded).toBe(true)
    expect(loadExtensionAsync).toHaveBeenCalledWith('/vec/lib', 'sqlite3_vec_init')
  })

  it('returns false when loadExtensionAsync throws', async () => {
    mockBundledExtensions['sqlite-vec'] = {
      libPath: '/vec/lib',
      entryPoint: 'sqlite3_vec_init'
    }
    const result = await loadExpoSqliteVecExtension({
      execAsync: vi.fn(),
      withTransactionAsync: vi.fn(),
      closeAsync: vi.fn(),
      loadExtensionAsync: vi.fn().mockRejectedValue(new Error('dlopen failed'))
    })
    expect(result.loaded).toBe(false)
    expect(result.reason).toContain('dlopen failed')
  })
})
