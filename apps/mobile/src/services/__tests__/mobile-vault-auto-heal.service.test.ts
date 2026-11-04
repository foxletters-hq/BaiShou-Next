import { describe, expect, it, vi } from 'vitest'
import { autoHealMobileDerivativeVaults } from '../mobile-vault-auto-heal.service'
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
    expect(contentAbc.vaultId).toBe('vlt_pers')
    expect(contentAbc.assistantId).toBe('latte')

    expect(await fs.exists('/root/Personal/Sessions/sess_xyz.json')).toBe(true)
    const contentXyz = JSON.parse(await fs.readFile('/root/Personal/Sessions/sess_xyz.json'))
    expect(contentXyz.vaultName).toBe('Personal')
    expect(contentXyz.vaultId).toBe('vlt_pers')
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

  it('cleans sessions that reference a derivative vault even after its directory was removed', async () => {
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

  it('does not remove the derivative vault the user is currently using', async () => {
    const fs = new MockMemoryFileSystem()
    await fs.mkdir('/root/Personal/Sessions')
    await fs.mkdir('/root/Personal82/Sessions')
    await fs.writeFile(
      '/root/Personal82/Sessions/sess_active.json',
      JSON.stringify({
        id: 'sess_active',
        vaultName: 'Personal82',
        assistantId: 'default'
      })
    )

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
    expect(await fs.exists('/root/Personal82/Sessions/sess_active.json')).toBe(true)
    expect(await fs.exists('/root/Personal/Sessions/sess_active.json')).toBe(false)
    expect(initRegistry).not.toHaveBeenCalled()
  })

  it('cleans orphaned derivative sessions directly in Personal/Sessions even with clean registry and no derivative dirs', async () => {
    const fs = new MockMemoryFileSystem()
    await fs.mkdir('/root/Personal/Sessions')
    // 模拟用户的真实数据场景：Personal8273 衍生会话直接落在 Personal/Sessions 下
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
    // 模拟早期会话遗留随机 ID
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
    // 干净的 registry，只有 Personal
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

  it('merges Assistants from derivative vaults into Personal', async () => {
    const fs = new MockMemoryFileSystem()
    await fs.mkdir('/root/Personal/Assistants')
    await fs.writeFile(
      '/root/Personal/Assistants/latte.json',
      JSON.stringify({ id: 'latte', name: '宇泽玲夏', isDefault: true })
    )

    // 衍生工作区 Personal45
    await fs.mkdir('/root/Personal45/Assistants')
    await fs.writeFile(
      '/root/Personal45/Assistants/ast_custom.json',
      JSON.stringify({ id: 'ast_custom', name: '宇泽玲静', isDefault: false })
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
      sqlExecutor
    })

    expect(result.healed).toBe(true)
    expect(result.removedVaults).toContain('Personal45')

    // 验证自定义助手已被合并到 Personal
    expect(await fs.exists('/root/Personal/Assistants/ast_custom.json')).toBe(true)
    const customContent = JSON.parse(await fs.readFile('/root/Personal/Assistants/ast_custom.json'))
    expect(customContent.name).toBe('宇泽玲静')

    // 验证衍生工作区已删除
    expect(await fs.exists('/root/Personal45')).toBe(false)
  })
})
