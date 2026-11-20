import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  autoHealMobileDerivativeVaults,
  resetAutoHealMemoryStateForTest
} from '../mobile-vault-auto-heal.service'
import type { IFileSystem, FileStat } from '@baishou/core-mobile'

class MockMemoryFileSystem implements IFileSystem {
  private files = new Map<string, string>()
  private dirs = new Set<string>()

  constructor() {
    this.dirs.add('/root')
  }

  async exists(path: string): Promise<boolean> {
    const normalized = path.replace(/\/+$/, '')
    return this.files.has(normalized) || this.dirs.has(normalized)
  }

  async mkdir(path: string): Promise<void> {
    const parts = path.split('/').filter(Boolean)
    let current = ''
    for (const part of parts) {
      current += '/' + part
      this.dirs.add(current)
    }
  }

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path.replace(/\/+$/, ''))
    if (content === undefined) {
      throw new Error(`ENOENT: ${path}`)
    }
    return content
  }

  async writeFile(path: string, data: string): Promise<void> {
    const normalized = path.replace(/\/+$/, '')
    this.files.set(normalized, data)
    const parent = normalized.slice(0, normalized.lastIndexOf('/'))
    if (parent) {
      await this.mkdir(parent)
    }
  }

  async appendFile(path: string, data: string): Promise<void> {
    const current = (await this.exists(path)) ? await this.readFile(path) : ''
    await this.writeFile(path, current + data)
  }

  async copyFile(src: string, dest: string): Promise<void> {
    const content = await this.readFile(src)
    await this.writeFile(dest, content)
  }

  async unlink(path: string): Promise<void> {
    this.files.delete(path.replace(/\/+$/, ''))
  }

  async readdir(path: string): Promise<string[]> {
    const dir = path.replace(/\/+$/, '')
    const prefix = dir === '' ? '/' : dir + '/'
    const entries = new Set<string>()

    for (const f of this.files.keys()) {
      if (f.startsWith(prefix)) {
        const rest = f.slice(prefix.length)
        const segment = rest.split('/')[0]
        if (segment) entries.add(segment)
      }
    }

    for (const d of this.dirs) {
      if (d !== dir && d.startsWith(prefix)) {
        const rest = d.slice(prefix.length)
        const segment = rest.split('/')[0]
        if (segment) entries.add(segment)
      }
    }

    return Array.from(entries)
  }

  async stat(path: string): Promise<FileStat> {
    const normalized = path.replace(/\/+$/, '')
    if (this.files.has(normalized)) {
      const content = this.files.get(normalized)!
      return {
        isFile: true,
        isDirectory: false,
        size: content.length,
        mtimeMs: 1000
      }
    }
    if (this.dirs.has(normalized)) {
      return {
        isFile: false,
        isDirectory: true
      }
    }
    throw new Error(`ENOENT: ${path}`)
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const content = await this.readFile(oldPath)
    await this.writeFile(newPath, content)
    await this.unlink(oldPath)
  }

  async rm(path: string): Promise<void> {
    const normalized = path.replace(/\/+$/, '')
    const prefix = normalized + '/'
    for (const f of Array.from(this.files.keys())) {
      if (f === normalized || f.startsWith(prefix)) {
        this.files.delete(f)
      }
    }
    for (const d of Array.from(this.dirs)) {
      if (d === normalized || d.startsWith(prefix)) {
        this.dirs.delete(d)
      }
    }
  }
}

describe('mobile-vault-auto-heal.service', () => {
  beforeEach(() => {
    resetAutoHealMemoryStateForTest()
  })

  it('returns early when no derivative vaults exist', async () => {
    const fs = new MockMemoryFileSystem()
    await fs.mkdir('/root/Personal')

    const result = await autoHealMobileDerivativeVaults({
      fileSystem: fs,
      storageRoot: '/root'
    })

    expect(result.healed).toBe(false)
    expect(result.mergedSessions).toBe(0)
    expect(result.mergedJournals).toBe(0)
    expect(result.removedVaults).toEqual([])
  })

  it('preserves derivative vaults that contain real user data even when Personal is active', async () => {
    const fs = new MockMemoryFileSystem()
    await fs.mkdir('/root/Personal/Journals/2026/07')
    await fs.writeFile('/root/Personal/Journals/2026/07/01.md', '# Personal 日记')

    // 用户把 Personal45 当主工作空间使用，即使切去 Personal 看了一眼也不能被静默拆解
    await fs.mkdir('/root/Personal45/Sessions')
    await fs.writeFile(
      '/root/Personal45/Sessions/sess_abc.json',
      JSON.stringify({
        id: 'sess_abc',
        title: '主空间会话',
        vaultName: 'Personal45',
        vaultId: 'vlt_p45',
        assistantId: 'latte'
      })
    )
    await fs.mkdir('/root/Personal45/Journals/2026/07')
    await fs.writeFile('/root/Personal45/Journals/2026/07/14.md', '# 主空间日记')
    await fs.mkdir('/root/Personal45/Assistants')
    await fs.writeFile(
      '/root/Personal45/Assistants/ast_custom.json',
      JSON.stringify({ id: 'ast_custom', name: '自定义伙伴', isDefault: false })
    )

    await fs.writeFile(
      '/root/vault_registry.json',
      JSON.stringify([
        { id: 'vlt_pers', name: 'Personal', path: '/root/Personal' },
        { id: 'vlt_p45', name: 'Personal45', path: '/root/Personal45' }
      ])
    )

    const sqlExecutor = vi.fn().mockResolvedValue({ rows: [] })

    const result = await autoHealMobileDerivativeVaults({
      fileSystem: fs,
      storageRoot: '/root',
      activeVaultName: 'Personal',
      sqlExecutor
    })

    expect(result.healed).toBe(false)
    expect(result.mergedSessions).toBe(0)
    expect(result.mergedJournals).toBe(0)
    expect(result.removedVaults).toEqual([])

    // Personal45 所有用户文件与注册表条目均原样保留
    expect(await fs.exists('/root/Personal45/Sessions/sess_abc.json')).toBe(true)
    expect(await fs.exists('/root/Personal45/Journals/2026/07/14.md')).toBe(true)
    expect(await fs.exists('/root/Personal45/Assistants/ast_custom.json')).toBe(true)
    expect(await fs.exists('/root/Personal/Sessions/sess_abc.json')).toBe(false)
    expect(await fs.exists('/root/Personal/Journals/2026/07/14.md')).toBe(false)

    const registry = JSON.parse(await fs.readFile('/root/vault_registry.json'))
    expect(registry.map((item: { name: string }) => item.name)).toEqual(['Personal', 'Personal45'])
    expect(sqlExecutor).not.toHaveBeenCalled()
  })

  it('removes empty shell derivative vaults that have no user content and cleans registry', async () => {
    const fs = new MockMemoryFileSystem()
    await fs.mkdir('/root/Personal/Journals')
    await fs.mkdir('/root/Personal82/Journals')
    await fs.mkdir('/root/Personal82/Sessions')
    await fs.writeFile(
      '/root/Personal82/Assistants/latte.json',
      JSON.stringify({ id: 'latte', name: '拉提', isDefault: true })
    )
    await fs.writeFile(
      '/root/vault_registry.json',
      JSON.stringify([
        { id: 'vlt_pers', name: 'Personal', path: '/root/Personal' },
        { id: 'vlt_p82', name: 'Personal82', path: '/root/Personal82' }
      ])
    )

    const result = await autoHealMobileDerivativeVaults({
      fileSystem: fs,
      storageRoot: '/root',
      activeVaultName: 'Personal'
    })

    expect(result.healed).toBe(true)
    expect(result.removedVaults).toEqual(['Personal82'])
    expect(await fs.exists('/root/Personal82')).toBe(false)

    const registry = JSON.parse(await fs.readFile('/root/vault_registry.json'))
    expect(registry.map((item: { name: string }) => item.name)).toEqual(['Personal'])
  })

  it('does not remove even an empty derivative vault if the user is currently using it', async () => {
    const fs = new MockMemoryFileSystem()
    await fs.mkdir('/root/Personal')
    await fs.mkdir('/root/Personal82/Sessions')

    const initRegistry = vi.fn().mockResolvedValue(undefined)
    const vaultService = {
      getActiveVault: () => ({
        id: 'vlt_p82',
        name: 'Personal82',
        path: '/root/Personal82',
        createdAt: new Date(),
        lastAccessedAt: new Date()
      }),
      initRegistry
    }

    const result = await autoHealMobileDerivativeVaults({
      fileSystem: fs,
      storageRoot: '/root',
      vaultService: vaultService as never
    })

    expect(result.healed).toBe(false)
    expect(await fs.exists('/root/Personal82')).toBe(true)
    expect(initRegistry).not.toHaveBeenCalled()
  })

  it('does not rewrite unrelated Personal sessions when no derivative vault is present', async () => {
    const fs = new MockMemoryFileSystem()
    await fs.mkdir('/root/Personal/Sessions')
    await fs.writeFile(
      '/root/Personal/Sessions/sess_nested.json',
      JSON.stringify({
        session: {
          id: 'sess_nested',
          title: '嵌套老会话',
          vaultName: 'Personal',
          assistantId: 'latte'
        },
        messages: []
      })
    )

    const result = await autoHealMobileDerivativeVaults({
      fileSystem: fs,
      storageRoot: '/root'
    })

    expect(result.healed).toBe(false)
    const untouched = JSON.parse(await fs.readFile('/root/Personal/Sessions/sess_nested.json'))
    expect(untouched.session.vaultName).toBe('Personal')
    expect(untouched.session.assistantId).toBe('latte')
  })

  it('cleans sessions in Personal/Sessions that reference a removed derivative vault and prunes stale registry entry', async () => {
    const fs = new MockMemoryFileSystem()
    await fs.mkdir('/root/Personal/Sessions')
    await fs.writeFile(
      '/root/Personal/Sessions/sess_nested.json',
      JSON.stringify({
        session: {
          id: 'sess_nested',
          title: '嵌套老会话',
          vaultName: 'Personal8273',
          assistantId: null
        },
        messages: []
      })
    )
    await fs.writeFile(
      '/root/vault_registry.json',
      JSON.stringify([
        { id: 'vlt_pers', name: 'Personal', path: '/root/Personal' },
        { id: 'vlt_p8273', name: 'Personal8273', path: '/root/Personal8273' }
      ])
    )

    const result = await autoHealMobileDerivativeVaults({
      fileSystem: fs,
      storageRoot: '/root'
    })

    expect(result.healed).toBe(false)
    const sanitized = JSON.parse(await fs.readFile('/root/Personal/Sessions/sess_nested.json'))
    expect(sanitized.session.vaultName).toBe('Personal')
    expect(sanitized.session.assistantId).toBe('latte')

    const registry = JSON.parse(await fs.readFile('/root/vault_registry.json'))
    expect(registry.map((item: { name: string }) => item.name)).toEqual(['Personal'])
  })

  it('cleans orphaned derivative sessions directly in Personal/Sessions even with clean registry and no derivative dirs', async () => {
    const fs = new MockMemoryFileSystem()
    await fs.mkdir('/root/Personal/Sessions')
    await fs.writeFile(
      '/root/Personal/Sessions/1792893581323.json',
      JSON.stringify({
        session: {
          id: '1792893581323',
          title: '新的一天还记得我吗',
          vaultId: 'vlt_de4984f63c641c5e',
          vaultName: 'Personal8273',
          assistantId: '1792893571420'
        },
        messages: []
      })
    )
    await fs.writeFile(
      '/root/Personal/Sessions/1792838612754.json',
      JSON.stringify({
        session: {
          id: '1792838612754',
          title: '你是谁',
          vaultId: 'vlt_983254cfa2072f0c',
          vaultName: 'Personal',
          assistantId: 'latte'
        },
        messages: []
      })
    )
    await fs.writeFile(
      '/root/vault_registry.json',
      JSON.stringify([{ id: 'vlt_pers', name: 'Personal', path: '/root/Personal' }])
    )

    const sqlExecutor = vi.fn().mockResolvedValue({ rows: [] })
    await autoHealMobileDerivativeVaults({
      fileSystem: fs,
      storageRoot: '/root',
      sqlExecutor
    })

    const healedSess1 = JSON.parse(await fs.readFile('/root/Personal/Sessions/1792893581323.json'))
    expect(healedSess1.session.vaultName).toBe('Personal')
    expect(healedSess1.session.vaultId).toBe('vlt_pers')
    expect(healedSess1.session.assistantId).toBe('1792893571420')

    const healedSess2 = JSON.parse(await fs.readFile('/root/Personal/Sessions/1792838612754.json'))
    expect(healedSess2.session.vaultName).toBe('Personal')
    expect(healedSess2.session.vaultId).toBe('vlt_pers')
    expect(healedSess2.session.assistantId).toBe('latte')

    expect(sqlExecutor).toHaveBeenCalled()
  })

  it('skips full Personal/Sessions read on subsequent cold starts after one-time scan completes', async () => {
    const fs = new MockMemoryFileSystem()
    await fs.writeFile(
      '/root/Personal/Sessions/s1.json',
      JSON.stringify({ session: { id: 's1', vaultName: 'Personal', vaultId: 'vlt_pers' } })
    )
    await fs.writeFile(
      '/root/vault_registry.json',
      JSON.stringify([{ id: 'vlt_pers', name: 'Personal', path: '/root/Personal' }])
    )

    let completed = false
    const readFileSpy = vi.spyOn(fs, 'readFile')

    // 首次启动：执行一次扫描并记录完成
    await autoHealMobileDerivativeVaults({
      fileSystem: fs,
      storageRoot: '/root',
      hasCompletedPersonalSessionScan: async () => completed,
      markPersonalSessionScanCompleted: async () => {
        completed = true
      }
    })
    expect(completed).toBe(true)
    expect(readFileSpy).toHaveBeenCalledWith('/root/Personal/Sessions/s1.json', 'utf8')

    // 二次启动：零会话 JSON 读取
    readFileSpy.mockClear()
    await autoHealMobileDerivativeVaults({
      fileSystem: fs,
      storageRoot: '/root',
      hasCompletedPersonalSessionScan: async () => completed,
      markPersonalSessionScanCompleted: async () => {
        completed = true
      }
    })
    const sessionReads = readFileSpy.mock.calls.filter(([p]) => String(p).includes('/Sessions/'))
    expect(sessionReads).toHaveLength(0)

    // 后续若新出现空壳衍生目录，仍能正常触发清理
    await fs.mkdir('/root/Personal99/Sessions')
    const thirdResult = await autoHealMobileDerivativeVaults({
      fileSystem: fs,
      storageRoot: '/root',
      activeVaultName: 'Personal',
      hasCompletedPersonalSessionScan: async () => completed,
      markPersonalSessionScanCompleted: async () => {
        completed = true
      }
    })
    expect(thirdResult.removedVaults).toEqual(['Personal99'])
    expect(await fs.exists('/root/Personal99')).toBe(false)
  })
})
