import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { IStoragePathService } from '../vault/storage-path.types'
import { stableAssistantDiskJson } from './assistant-persist.util'

export class AssistantFileService {
  constructor(
    private readonly pathProvider: IStoragePathService,
    private readonly fileSystem: IFileSystem
  ) {}

  private async getDirectory(): Promise<string> {
    const targetDir = await this.pathProvider.getAssistantsBaseDirectory()
    await this.fileSystem.mkdir(targetDir, { recursive: true })
    return targetDir
  }

  async writeAssistant(id: string, data: any): Promise<string> {
    const dir = await this.getDirectory()
    const fullPath = path.join(dir, `${id}.json`)
    const nextContent = stableAssistantDiskJson(data as Record<string, unknown>)
    try {
      const existing = await this.fileSystem.readFile(fullPath, 'utf8')
      const existingContent = stableAssistantDiskJson(JSON.parse(existing) as Record<string, unknown>)
      if (existingContent === nextContent) {
        return fullPath
      }
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e
    }
    await this.fileSystem.writeFile(fullPath, nextContent, 'utf8')
    return fullPath
  }

  async readAssistant(id: string): Promise<any | null> {
    const dir = await this.getDirectory()
    const fullPath = path.join(dir, `${id}.json`)
    try {
      const content = await this.fileSystem.readFile(fullPath, 'utf8')
      return JSON.parse(content)
    } catch (e: any) {
      if (e.code === 'ENOENT') return null
      throw e
    }
  }

  async deleteAssistant(id: string): Promise<void> {
    const dir = await this.getDirectory()
    const fullPath = path.join(dir, `${id}.json`)
    try {
      await this.fileSystem.unlink(fullPath)
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e
    }
  }

  async listAllAssistants(): Promise<{ id: string; fullPath: string }[]> {
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
