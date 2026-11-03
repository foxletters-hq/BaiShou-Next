import { describe, expect, it, vi } from 'vitest'
import { autoHealMobileDerivativeVaults } from '../mobile-vault-auto-heal.service'
import type { IFileSystem, FileStat } from '@baishou/core-mobile'
import { deriveLegacyVaultId } from '@baishou/shared'

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
  })

  it('merges Sessions and Journals from derivative vaults into Personal', async () => {
    const fs = new MockMemoryFileSystem()
    await fs.mkdir('/root/Personal/Journals/2026/07')
    await fs.writeFile('/root/Personal/Journals/2026/07/01.md', '# 现有日记')

    // 衍生工作区 Personal82
    await fs.mkdir('/root/Personal82/Sessions')
    await fs.writeFile(
      '/root/Personal82/Sessions/sess_abc.json',
      JSON.stringify({
        id: 'sess_abc',
        title: '老会话',
        vaultName: 'Personal82',
        assistantId: 'default'
      })
    )
    await fs.mkdir('/root/Personal82/Journals/2026/07')
    await fs.writeFile('/root/Personal82/Journals/2026/07/14.md', '# 衍生工作区日记')

    // 衍生工作区 Personal8273
    await fs.mkdir('/root/Personal8273/Sessions')
    await fs.writeFile(
      '/root/Personal8273/Sessions/sess_xyz.json',
      JSON.stringify({
        id: 'sess_xyz',
        title: '新对话',
        vaultName: 'Personal8273'
      })
    )

    // vault_registry.json
    await fs.writeFile(
      '/root/vault_registry.json',
      JSON.stringify([
        { id: 'vlt_pers', name: 'Personal', path: '/root/Personal' },
        { id: 'vlt_p82', name: 'Personal82', path: '/root/Personal82' },
        { id: 'vlt_p8273', name: 'Personal8273', path: '/root/Personal8273' }
      ])
    )

    const sqlExecutor = vi.fn().mockResolvedValue({ rows: [] })

    const result = await autoHealMobileDerivativeVaults({
      fileSystem: fs,
      storageRoot: '/root',
      sqlExecutor
    })

    expect(result.healed).toBe(true)
    expect(result.mergedSessions).toBe(2)
    expect(result.mergedJournals).toBe(1)
    expect(result.removedVaults).toContain('Personal82')
    expect(result.removedVaults).toContain('Personal8273')

    // 验证会话文件已合并且内容已修正
    expect(await fs.exists('/root/Personal/Sessions/sess_abc.json')).toBe(true)
    const contentAbc = JSON.parse(await fs.readFile('/root/Personal/Sessions/sess_abc.json'))
    expect(contentAbc.vaultName).toBe('Personal')
    expect(contentAbc.vaultId).toBe(deriveLegacyVaultId('Personal'))
    expect(contentAbc.assistantId).toBe('latte')

    expect(await fs.exists('/root/Personal/Sessions/sess_xyz.json')).toBe(true)
    const contentXyz = JSON.parse(await fs.readFile('/root/Personal/Sessions/sess_xyz.json'))
    expect(contentXyz.vaultName).toBe('Personal')
    expect(contentXyz.vaultId).toBe(deriveLegacyVaultId('Personal'))
    expect(contentXyz.assistantId).toBe('latte')

    // 验证日记已合并
    expect(await fs.exists('/root/Personal/Journals/2026/07/14.md')).toBe(true)
    expect(await fs.exists('/root/Personal/Journals/2026/07/01.md')).toBe(true)

    // 验证衍生目录已清理
    expect(await fs.exists('/root/Personal82')).toBe(false)
    expect(await fs.exists('/root/Personal8273')).toBe(false)

    // 验证 vault_registry.json 已清理
    const registry = JSON.parse(await fs.readFile('/root/vault_registry.json'))
    expect(registry.length).toBe(1)
    expect(registry[0].name).toBe('Personal')

    // 验证 SQL 更新已执行
    expect(sqlExecutor).toHaveBeenCalled()
  })

  it('in-place sanitizes nested session JSON in Personal/Sessions even when no derivative vaults exist', async () => {
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

    const result = await autoHealMobileDerivativeVaults({
      fileSystem: fs,
      storageRoot: '/root'
    })

    expect(result.healed).toBe(false)
    const sanitized = JSON.parse(await fs.readFile('/root/Personal/Sessions/sess_nested.json'))
    expect(sanitized.session.vaultName).toBe('Personal')
    expect(sanitized.session.vaultId).toBe(deriveLegacyVaultId('Personal'))
    expect(sanitized.session.assistantId).toBe('latte')
    expect(sanitized.vaultName).toBe('Personal')
    expect(sanitized.assistantId).toBe('latte')
  })
})

