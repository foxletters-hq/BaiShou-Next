import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { IStoragePathService } from '../vault/storage-path.types'

export class SessionFileService {
  constructor(
    private readonly pathProvider: IStoragePathService,
    private readonly fileSystem: IFileSystem
  ) {}

  private async getDirectory(): Promise<string> {
    const targetDir = await this.pathProvider.getSessionsBaseDirectory()
    await this.fileSystem.mkdir(targetDir, { recursive: true })
    return targetDir
  }

  async writeSession(sessionId: string, sessionData: any): Promise<string> {
    const dir = await this.getDirectory()
    const fullPath = path.join(dir, `${sessionId}.json`)
    await this.fileSystem.writeFile(fullPath, JSON.stringify(sessionData, null, 2), 'utf8')
    return fullPath
  }

  async readSession(sessionId: string): Promise<any | null> {
    const dir = await this.getDirectory()
    const fullPath = path.join(dir, `${sessionId}.json`)
    try {
      const content = await this.fileSystem.readFile(fullPath, 'utf8')
      return JSON.parse(content)
    } catch (e: any) {
      if (e.code === 'ENOENT') return null
      throw e
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const dir = await this.getDirectory()
    const fullPath = path.join(dir, `${sessionId}.json`)
    try {
      await this.fileSystem.unlink(fullPath)
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e
    }
  }

  async listAllSessions(): Promise<{ id: string; fullPath: string }[]> {
    const dir = await this.getDirectory()
    let files: string[] = []
    try {
      files = await this.fileSystem.readdir(dir)
    } catch (e: any) {
      if (e.code !== 'ENOENT') return []
      throw e
    }

    const results: { id: string; fullPath: string }[] = []
    for (const f of files) {
      if (!f.endsWith('.json')) continue
      const id = f.slice(0, -5)
      results.push({ id, fullPath: path.join(dir, f) })
    }
    return results
  }
}
