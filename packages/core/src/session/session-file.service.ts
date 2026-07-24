import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { IStoragePathService } from '../vault/storage-path.types'

export class SessionFileService {
  constructor(
    private readonly pathProvider: IStoragePathService,
    private readonly fileSystem: IFileSystem,
    private readonly rawDataSourceManager?: import('../raw-data/raw-data-source.manager').RawDataSourceManager
  ) {}

  private async getDirectory(vaultName?: string | null): Promise<string> {
    if (vaultName?.trim()) {
      const vaultDir = await this.pathProvider.getVaultDirectory(vaultName.trim())
      const targetDir = path.join(vaultDir, 'Sessions')
      await this.fileSystem.mkdir(targetDir, { recursive: true })
      return targetDir
    }
    const targetDir = await this.pathProvider.getSessionsBaseDirectory()
    await this.fileSystem.mkdir(targetDir, { recursive: true })
    return targetDir
  }

  async writeSession(
    sessionId: string,
    sessionData: any,
    vaultName?: string | null
  ): Promise<string> {
    const dir = await this.getDirectory(vaultName)
    const fullPath = path.join(dir, `${sessionId}.json`)
    const next = JSON.stringify(sessionData)
    try {
      const prevRaw = await this.fileSystem.readFile(fullPath, 'utf8')
      // 内容语义相同则跳过写盘，避免 mtime/hash 抖动导致下次又被判定 upload
      if (JSON.stringify(JSON.parse(prevRaw)) === JSON.stringify(JSON.parse(next))) {
        return fullPath
      }
    } catch {
      // 文件不存在或损坏时继续写入
    }
    if (this.rawDataSourceManager) {
      await this.rawDataSourceManager.writeFile('session', `${sessionId}.json`, next)
      return fullPath
    }
    await this.fileSystem.writeFile(fullPath, next, 'utf8')
    return fullPath
  }

  async readSession(sessionId: string, vaultName?: string | null): Promise<any | null> {
    const dir = await this.getDirectory(vaultName)
    const fullPath = path.join(dir, `${sessionId}.json`)
    try {
      const content = await this.fileSystem.readFile(fullPath, 'utf8')
      return JSON.parse(content)
    } catch (e: any) {
      if (e.code === 'ENOENT') return null
      throw e
    }
  }

  async getSessionFileByteSize(
    sessionId: string,
    vaultName?: string | null
  ): Promise<number | undefined> {
    const dir = await this.getDirectory(vaultName)
    const fullPath = path.join(dir, `${sessionId}.json`)
    try {
      const stat = await this.fileSystem.stat(fullPath)
      if (!stat.isFile) return undefined
      return stat.size
    } catch {
      return undefined
    }
  }

  /** 会话 JSON 的磁盘 mtime（ms）；文件不存在或不可读时返回 undefined */
  async getSessionFileMtimeMs(
    sessionId: string,
    vaultName?: string | null
  ): Promise<number | undefined> {
    const dir = await this.getDirectory(vaultName)
    const fullPath = path.join(dir, `${sessionId}.json`)
    try {
      const stat = await this.fileSystem.stat(fullPath)
      if (!stat.isFile || stat.mtimeMs == null) return undefined
      return stat.mtimeMs
    } catch {
      return undefined
    }
  }

  async deleteSession(sessionId: string, vaultName?: string | null): Promise<void> {
    const dir = await this.getDirectory(vaultName)
    const fullPath = path.join(dir, `${sessionId}.json`)
    try {
      await this.fileSystem.unlink(fullPath)
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e
    }
  }

  async listAllSessions(
    vaultName?: string | null
  ): Promise<{ id: string; fullPath: string; vaultName?: string }[]> {
    const dir = await this.getDirectory(vaultName)
    let files: string[] = []
    try {
      files = await this.fileSystem.readdir(dir)
    } catch (e: any) {
      if (e.code === 'ENOENT') return []
      throw e
    }

    const results: { id: string; fullPath: string; vaultName?: string }[] = []
    for (const f of files) {
      if (!f.endsWith('.json')) continue
      const id = f.slice(0, -5)
      results.push({
        id,
        fullPath: path.join(dir, f),
        ...(vaultName?.trim() ? { vaultName: vaultName.trim() } : {})
      })
    }
    return results
  }

  /** 列出多个工作区 Sessions 目录中的全部会话文件 */
  async listSessionsAcrossVaults(
    vaultNames: string[]
  ): Promise<{ id: string; fullPath: string; vaultName: string }[]> {
    const unique = [...new Set(vaultNames.map((n) => n.trim()).filter(Boolean))]
    const results: { id: string; fullPath: string; vaultName: string }[] = []
    for (const vaultName of unique) {
      const listed = await this.listAllSessions(vaultName)
      for (const item of listed) {
        results.push({ id: item.id, fullPath: item.fullPath, vaultName })
      }
    }
    return results
  }
}
