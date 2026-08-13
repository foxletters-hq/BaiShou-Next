import { md5Hex } from '../../fs/md5'
import * as path from '../../fs/path.util'
import type { IFileSystem } from '../../fs/file-system.types'
import type { IStoragePathService } from '../../vault/storage-path.types'
import type { IVersionManager } from '../../sync/version-manager.interface'
import type { WholeFileKindManager, WriteOpts } from '../raw-data-source.types'
import { collapseJsonlById } from '../stores/monthly-jsonl.store'

/** 结构层 JSONL 行（笔记本清单） */
export interface NotebookRawRecord {
  id: string
  name: string
  description?: string
  createdAt: number
  updatedAt: number
  deletedAt?: number | null
}

/** 结构层 JSONL 行（资料清单） */
export interface NotebookSourceRawRecord {
  id: string
  title: string
  kind: 'file' | 'url' | 'text' | string
  path?: string | null
  contentHash: string
  extractEngine?: string
  pageCount?: number | null
  createdAt: number
  updatedAt: number
  deletedAt?: number | null
}

function bytesToLatin1(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]!)
  }
  return out
}

function base64ToBytes(b64: string): Uint8Array {
  // Prefer Buffer when available (Node / Electron)
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'))
  }
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

function shouldSkipVersionByDefault(relativePath: string): boolean {
  const norm = relativePath.replace(/\\/g, '/')
  // 原文层 / 提取正文：默认跳过版本快照（体积大、覆盖写）
  if (norm.includes('/sources/') || norm.startsWith('sources/')) return true
  if (norm.includes('/extracted/') || norm.startsWith('extracted/')) return true
  // 嵌套路径：<notebookId>/sources/... 或 <notebookId>/extracted/...
  if (/\/sources\//.test(norm) || /\/extracted\//.test(norm)) return true
  return false
}

/**
 * 知识库 Notebooks/ 写入器：二进制安全（copyFile / base64），
 * 原文与提取正文默认 skipVersion。
 */
export class NotebookRawManager implements WholeFileKindManager {
  readonly kind = 'notebook' as const
  readonly shape = 'whole-file' as const

  constructor(
    private readonly pathService: IStoragePathService,
    private readonly fs: IFileSystem,
    private readonly versionManager?: IVersionManager,
    private readonly maxVersionsPerFile = 20
  ) {}

  private async baseDir(): Promise<string> {
    return this.pathService.getNotebooksBaseDirectory()
  }

  /**
   * 写入文件。Uint8Array / base64 字符串走二进制路径；普通 UTF-8 文本用于 JSONL / md。
   */
  async writeFile(
    relativePath: string,
    content: string | Uint8Array,
    opts?: WriteOpts & { encoding?: 'utf8' | 'base64'; copyFrom?: string }
  ): Promise<{ contentHash: string }> {
    const base = await this.baseDir()
    const abs = path.join(base, relativePath)
    const dir = path.dirname(abs)
    await this.fs.mkdir(dir, { recursive: true })

    const skipVersion = opts?.skipVersion ?? shouldSkipVersionByDefault(relativePath)

    let contentHash: string

    if (opts?.copyFrom) {
      await this.fs.copyFile(opts.copyFrom, abs)
      const b64 = await this.fs.readFile(abs, 'base64')
      contentHash = md5Hex(bytesToLatin1(base64ToBytes(b64)))
    } else if (content instanceof Uint8Array) {
      contentHash = md5Hex(bytesToLatin1(content))
      await this.fs.writeFile(abs, bytesToBase64(content), 'base64')
    } else if (opts?.encoding === 'base64') {
      const bytes = base64ToBytes(content)
      contentHash = md5Hex(bytesToLatin1(bytes))
      await this.fs.writeFile(abs, content, 'base64')
    } else {
      contentHash = md5Hex(content)
      if (!skipVersion && this.versionManager) {
        await this.maybeBackup(abs, contentHash)
      }
      await this.fs.writeFile(abs, content, 'utf8')
      return { contentHash }
    }

    if (!skipVersion && this.versionManager) {
      // 二进制一般不打版本；若显式要求仍尝试（结构层不会走此分支）
      await this.maybeBackupBinary(abs)
    }

    return { contentHash }
  }

  /** 从本机路径复制原文（PDF 等），字节级一致 */
  async copySourceFile(
    relativePath: string,
    absoluteSourcePath: string
  ): Promise<{ contentHash: string }> {
    return this.writeFile(relativePath, '', {
      copyFrom: absoluteSourcePath,
      skipVersion: true
    })
  }

  async appendNotebookRecord(record: NotebookRawRecord): Promise<void> {
    const base = await this.baseDir()
    const file = path.join(base, 'notebooks.jsonl')
    await this.fs.mkdir(base, { recursive: true })
    await this.fs.appendFile(file, `${JSON.stringify(record)}\n`, 'utf8')
  }

  async appendSourceRecord(notebookId: string, record: NotebookSourceRawRecord): Promise<void> {
    const base = await this.baseDir()
    const dir = path.join(base, notebookId)
    await this.fs.mkdir(dir, { recursive: true })
    const file = path.join(dir, 'sources.jsonl')
    await this.fs.appendFile(file, `${JSON.stringify(record)}\n`, 'utf8')
  }

  async listNotebookRecords(): Promise<NotebookRawRecord[]> {
    const base = await this.baseDir()
    const file = path.join(base, 'notebooks.jsonl')
    if (!(await this.fs.exists(file))) return []
    const raw = await this.fs.readFile(file, 'utf8')
    const rows = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as NotebookRawRecord
        } catch {
          return null
        }
      })
      .filter((r): r is NotebookRawRecord => r != null && typeof r.id === 'string')
    return collapseJsonlById(rows).filter((r) => !r.deletedAt)
  }

  async listSourceRecords(notebookId: string): Promise<NotebookSourceRawRecord[]> {
    const base = await this.baseDir()
    const file = path.join(base, notebookId, 'sources.jsonl')
    if (!(await this.fs.exists(file))) return []
    const raw = await this.fs.readFile(file, 'utf8')
    const rows = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as NotebookSourceRawRecord
        } catch {
          return null
        }
      })
      .filter((r): r is NotebookSourceRawRecord => r != null && typeof r.id === 'string')
    return collapseJsonlById(rows).filter((r) => !r.deletedAt)
  }

  async readExtractedText(notebookId: string, sourceId: string): Promise<string | null> {
    const base = await this.baseDir()
    const file = path.join(base, notebookId, 'extracted', `${sourceId}.md`)
    if (!(await this.fs.exists(file))) return null
    return this.fs.readFile(file, 'utf8')
  }

  async readPagesJson(
    notebookId: string,
    sourceId: string
  ): Promise<{ pages: Array<{ page: number; start: number; end: number }> } | null> {
    const base = await this.baseDir()
    const file = path.join(base, notebookId, 'extracted', `${sourceId}.pages.json`)
    if (!(await this.fs.exists(file))) return null
    try {
      const raw = await this.fs.readFile(file, 'utf8')
      const parsed = JSON.parse(raw) as {
        pages?: Array<{ page: number; start: number; end: number }>
      }
      if (!Array.isArray(parsed?.pages)) return null
      return { pages: parsed.pages }
    } catch {
      return null
    }
  }

  async writeExtracted(
    notebookId: string,
    sourceId: string,
    text: string,
    pages?: { pages: Array<{ page: number; start: number; end: number }> }
  ): Promise<{ textHash: string }> {
    const textRel = path.join(notebookId, 'extracted', `${sourceId}.md`)
    const { contentHash } = await this.writeFile(textRel, text, { skipVersion: true })
    if (pages) {
      const pagesRel = path.join(notebookId, 'extracted', `${sourceId}.pages.json`)
      await this.writeFile(pagesRel, JSON.stringify(pages), { skipVersion: true })
    }
    return { textHash: contentHash }
  }

  async absolutePath(relativePath: string): Promise<string> {
    const base = await this.baseDir()
    const abs = path.resolve(base, relativePath)
    if (!path.isPathInside(base, abs)) {
      throw new Error(`path escapes notebooks root: ${relativePath}`)
    }
    return abs
  }

  private async maybeBackup(abs: string, nextHash: string): Promise<void> {
    if (!this.versionManager) return
    const exists = await this.fs.exists(abs)
    if (!exists) return
    try {
      const prev = await this.fs.readFile(abs, 'utf8')
      if (md5Hex(prev) === nextHash) return
      const vaultRel = await this.toVaultRelativePath(abs)
      if (!vaultRel) return
      await this.versionManager.backup(vaultRel)
      await this.versionManager.cleanup(vaultRel, this.maxVersionsPerFile)
    } catch {
      /* best-effort */
    }
  }

  private async maybeBackupBinary(abs: string): Promise<void> {
    if (!this.versionManager) return
    try {
      const vaultRel = await this.toVaultRelativePath(abs)
      if (!vaultRel) return
      await this.versionManager.backup(vaultRel)
      await this.versionManager.cleanup(vaultRel, this.maxVersionsPerFile)
    } catch {
      /* best-effort */
    }
  }

  private async toVaultRelativePath(absolutePath: string): Promise<string | null> {
    const vault = await this.pathService.getActiveVaultPath()
    if (!vault) return null
    const normVault = vault.replace(/\\/g, '/').replace(/\/+$/, '')
    const normAbs = absolutePath.replace(/\\/g, '/')
    if (!normAbs.startsWith(normVault + '/') && normAbs !== normVault) return null
    return normAbs.slice(normVault.length + 1)
  }
}
