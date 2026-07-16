import { md5Hex } from '../../fs/md5'
import * as path from '../../fs/path.util'
import type { IFileSystem } from '../../fs/file-system.types'
import type { IStoragePathService } from '../../vault/storage-path.types'
import type { IVersionManager } from '../../sync/version-manager.interface'
import type {
  RawSourceKind,
  WholeFileKindManager,
  WriteOpts
} from '../raw-data-source.types'

type WholeFileKind = Extract<RawSourceKind, 'journal' | 'summary' | 'session'>

async function contentToString(content: string | Uint8Array): Promise<string> {
  if (typeof content === 'string') return content
  // Uint8Array → utf8
  let out = ''
  for (let i = 0; i < content.length; i++) {
    out += String.fromCharCode(content[i]!)
  }
  try {
    return decodeURIComponent(escape(out))
  } catch {
    return out
  }
}

/**
 * Thin whole-file writer for journal / summary / session.
 * relativePath is under the kind root (e.g. 2026/07/2026-07-16.md).
 */
export class WholeFileRawManager implements WholeFileKindManager {
  readonly shape = 'whole-file' as const

  constructor(
    readonly kind: WholeFileKind,
    private readonly pathService: IStoragePathService,
    private readonly fs: IFileSystem,
    private readonly versionManager?: IVersionManager,
    private readonly maxVersionsPerFile = 20
  ) {}

  private async baseDir(): Promise<string> {
    switch (this.kind) {
      case 'journal':
        return this.pathService.getJournalsBaseDirectory()
      case 'summary':
        return this.pathService.getSummariesBaseDirectory()
      case 'session':
        return this.pathService.getSessionsBaseDirectory()
    }
  }

  async writeFile(
    relativePath: string,
    content: string | Uint8Array,
    opts?: WriteOpts
  ): Promise<{ contentHash: string }> {
    const base = await this.baseDir()
    const abs = path.join(base, relativePath)
    const text = await contentToString(content)
    const nextHash = md5Hex(text)

    const dir = path.dirname(abs)
    await this.fs.mkdir(dir, { recursive: true })

    if (!opts?.skipVersion && this.versionManager) {
      const exists = await this.fs.exists(abs)
      if (exists) {
        const prev = await this.fs.readFile(abs, 'utf8')
        if (md5Hex(prev) !== nextHash) {
          const vaultRel = await this.toVaultRelativePath(abs)
          if (vaultRel) {
            try {
              await this.versionManager.backup(vaultRel)
              await this.versionManager.cleanup(vaultRel, this.maxVersionsPerFile)
            } catch {
              // Version backup is best-effort; do not block writes
            }
          }
        }
      }
    }

    await this.fs.writeFile(abs, text, 'utf8')
    return { contentHash: nextHash }
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
