import { describe, expect, it } from 'vitest'
import type { FileStat, IFileSystem } from '../../fs/file-system.types'
import { vaultDirectoryHasUserContent } from '../legacy-migration.vaults'

class MemoryFs implements IFileSystem {
  private files = new Map<string, string>()
  private dirs = new Set<string>(['/root'])

  async exists(p: string): Promise<boolean> {
    const n = p.replace(/\/+$/, '')
    return this.files.has(n) || this.dirs.has(n)
  }

  async mkdir(p: string): Promise<void> {
    const parts = p.split('/').filter(Boolean)
    let cur = ''
    for (const part of parts) {
      cur += '/' + part
      this.dirs.add(cur)
    }
  }

  async readFile(p: string): Promise<string> {
    const val = this.files.get(p.replace(/\/+$/, ''))
    if (val === undefined) throw new Error(`ENOENT: ${p}`)
    return val
  }

  async writeFile(p: string, data: string): Promise<void> {
    const n = p.replace(/\/+$/, '')
    this.files.set(n, data)
    const parent = n.slice(0, n.lastIndexOf('/'))
    if (parent) await this.mkdir(parent)
  }

  async appendFile(p: string, data: string): Promise<void> {
    const cur = (await this.exists(p)) ? await this.readFile(p) : ''
    await this.writeFile(p, cur + data)
  }

  async copyFile(src: string, dest: string): Promise<void> {
    await this.writeFile(dest, await this.readFile(src))
  }

  async unlink(p: string): Promise<void> {
    this.files.delete(p.replace(/\/+$/, ''))
  }

  async readdir(p: string): Promise<string[]> {
    const dir = p.replace(/\/+$/, '')
    const prefix = dir + '/'
    const out = new Set<string>()
    for (const key of [...this.files.keys(), ...this.dirs]) {
      if (key.startsWith(prefix)) {
        const seg = key.slice(prefix.length).split('/')[0]
        if (seg) out.add(seg)
      }
    }
    return Array.from(out)
  }

  async stat(p: string): Promise<FileStat> {
    const n = p.replace(/\/+$/, '')
    if (this.files.has(n)) {
      return { isFile: true, isDirectory: false, size: this.files.get(n)!.length, mtimeMs: 1000 }
    }
    if (this.dirs.has(n)) {
      return { isFile: false, isDirectory: true }
    }
    throw new Error(`ENOENT: ${p}`)
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await this.writeFile(newPath, await this.readFile(oldPath))
    await this.unlink(oldPath)
  }

  async rm(p: string): Promise<void> {
    const n = p.replace(/\/+$/, '')
    const prefix = n + '/'
    for (const k of Array.from(this.files.keys())) {
      if (k === n || k.startsWith(prefix)) this.files.delete(k)
    }
    for (const d of Array.from(this.dirs)) {
      if (d === n || d.startsWith(prefix)) this.dirs.delete(d)
    }
  }
}

describe('vaultDirectoryHasUserContent', () => {
  it('should treat fresh install empty folders and untouched default latte.json as empty placeholder', async () => {
    const fs = new MemoryFs()
    await fs.mkdir('/root/Personal/Journals')
    await fs.mkdir('/root/Personal/Sessions')
    await fs.mkdir('/root/Personal/config')
    await fs.writeFile(
      '/root/Personal/Assistants/latte.json',
      JSON.stringify({ id: 'latte', name: '拉提', isDefault: true })
    )

    expect(await vaultDirectoryHasUserContent(fs, '/root', 'Personal')).toBe(false)
  })

  it('should detect user content when a journal markdown file exists', async () => {
    const fs = new MemoryFs()
    await fs.writeFile('/root/Personal/Journals/2026/11/2026-11-19.md', '# 日记')

    expect(await vaultDirectoryHasUserContent(fs, '/root', 'Personal')).toBe(true)
  })

  it('should detect user content when a session json file exists', async () => {
    const fs = new MemoryFs()
    await fs.writeFile('/root/Personal/Sessions/s1.json', JSON.stringify({ id: 's1' }))

    expect(await vaultDirectoryHasUserContent(fs, '/root', 'Personal')).toBe(true)
  })

  it('should detect user content when a custom assistant or modified latte exists', async () => {
    const fsCustom = new MemoryFs()
    await fsCustom.writeFile(
      '/root/Personal/Assistants/ast_1.json',
      JSON.stringify({ id: 'ast_1', name: '小夏' })
    )
    expect(await vaultDirectoryHasUserContent(fsCustom, '/root', 'Personal')).toBe(true)

    const fsModifiedLatte = new MemoryFs()
    await fsModifiedLatte.writeFile(
      '/root/Personal/Assistants/latte.json',
      JSON.stringify({ id: 'latte', name: '小玲纱', customSystemPrompt: '自定义人设' })
    )
    expect(await vaultDirectoryHasUserContent(fsModifiedLatte, '/root', 'Personal')).toBe(true)
  })

  it('should short-circuit on the first non-hidden file under Attachments instead of counting all files', async () => {
    const fs = new MemoryFs()
    for (let i = 0; i < 50; i++) {
      await fs.writeFile(`/root/Personal/Attachments/img_${i}.png`, 'x')
    }
    let statCalls = 0
    const origStat = fs.stat.bind(fs)
    fs.stat = async (p: string) => {
      statCalls++
      return origStat(p)
    }

    expect(await vaultDirectoryHasUserContent(fs, '/root', 'Personal')).toBe(true)
    expect(statCalls).toBe(1)
  })
})
