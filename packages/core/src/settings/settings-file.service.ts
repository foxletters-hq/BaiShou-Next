import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { IStoragePathService } from '../vault/storage-path.types'

export class SettingsFileService {
  private writeLock: Promise<void> = Promise.resolve()

  constructor(
    private readonly pathProvider: IStoragePathService,
    private readonly fileSystem: IFileSystem
  ) {}

  private async getSettingsPath(): Promise<string> {
    const sysDir = await this.pathProvider.getVaultSystemDirectory('default')
    return path.join(sysDir, 'settings.json')
  }

  async writeAllSettings(settingsMap: Record<string, any>): Promise<void> {
    const fullPath = await this.getSettingsPath()
    const tmpPath = fullPath + '.tmp'

    const writeOp = async () => {
      await this.fileSystem.writeFile(tmpPath, JSON.stringify(settingsMap, null, 2), 'utf8')
      try {
        await this.fileSystem.rename(tmpPath, fullPath)
      } catch (renameErr: any) {
        if (
          renameErr.code === 'EXDEV' ||
          renameErr.code === 'EPERM' ||
          renameErr.code === 'EEXIST'
        ) {
          try {
            await this.fileSystem.unlink(fullPath)
          } catch (unlinkErr: any) {
            if (unlinkErr.code !== 'ENOENT') {
              throw unlinkErr
            }
          }
          await this.fileSystem.rename(tmpPath, fullPath)
        } else {
          throw renameErr
        }
      }
    }

    const nextLock = this.writeLock.then(writeOp, writeOp)
    this.writeLock = nextLock
    await nextLock
  }

  async readAllSettings(): Promise<Record<string, any>> {
    const fullPath = await this.getSettingsPath()
    try {
      const content = await this.fileSystem.readFile(fullPath, 'utf8')
      if (!content || content.trim() === '') return {}

      try {
        return JSON.parse(content) || {}
      } catch (jsonErr: any) {
        console.error(`[SettingsFileService] ❌ JSON 解析崩溃 at ${fullPath}:`, jsonErr.message)
        const recovered = this.recoverPartialJSON(content)
        if (recovered) {
          console.warn(
            `[SettingsFileService] ⚡ 已恢复部分设置（共 ${Object.keys(recovered).length} 个键），正在重写文件...`
          )
          await this.writeAllSettings(recovered)
          return recovered
        }
        console.error(`[SettingsFileService] ⚠️ 无法恢复，建议手动检查或删除该文件以重置设置。`)
        return {}
      }
    } catch (e: any) {
      if (e.code === 'ENOENT') return {}
      throw e
    }
  }

  private recoverPartialJSON(content: string): Record<string, any> | null {
    try {
      return JSON.parse(content) as Record<string, any>
    } catch {
      for (let len = content.length - 1; len > 0; len--) {
        const ch = content[len]
        if (ch === '}' || ch === ']') {
          try {
            const candidate = content.slice(0, len + 1)
            const parsed = JSON.parse(candidate)
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
              return parsed as Record<string, any>
            }
          } catch {
            continue
          }
        }
      }
      return null
    }
  }
}
