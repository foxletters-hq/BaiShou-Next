import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureMobileGraphFreshnessBound } from '../mobile-graph-extract'
import { resetMobileRawDataRuntime } from '../mobile-raw-data-source.runtime'

function fakeDeps() {
  const asyncNoop = vi.fn(async () => undefined)
  const proxy = (extra: Record<string, unknown>) =>
    new Proxy(extra, {
      get: (target, key: string) => (key in target ? target[key] : asyncNoop)
    })
  return {
    vaultName: 'V',
    vaultId: 'vlt_test',
    shadowRepo: { listAll: vi.fn(async () => []) } as never,
    pathService: proxy({
      getActiveVaultPath: async () => '/vault',
      getVaultRootPath: async () => '/vault',
      getRootDirectory: async () => '/root'
    }) as never,
    fileSystem: proxy({
      exists: async () => false,
      readdir: async () => [],
      readFile: async () => ''
    }) as never
  }
}

describe('ensureMobileGraphFreshnessBound', () => {
  beforeEach(() => {
    resetMobileRawDataRuntime()
  })

  it('原始数据运行时重建后，新的 freshness 也要重新绑定', async () => {
    const deps = fakeDeps()
    ensureMobileGraphFreshnessBound(deps)

    resetMobileRawDataRuntime()
    const rebuilt = ensureMobileGraphFreshnessBound(deps)

    let message = ''
    try {
      await rebuilt.commitReextract('Journals/a.md', 'hash')
    } catch (e) {
      message = e instanceof Error ? e.message : String(e)
    }
    expect(message).not.toContain('collaborators not bound')
  })
})
