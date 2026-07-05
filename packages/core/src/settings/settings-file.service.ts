import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { IStoragePathService } from '../vault/storage-path.types'
import {
  LEGACY_SETTINGS_FILENAME,
  LEGACY_SETTINGS_MIGRATED_SUFFIX,
  SETTINGS_DOMAIN_FILE_NAMES,
  groupSettingsByDomainFile
} from './settings-domain.util'

export class SettingsFileService {
  private writeLock: Promise<void> = Promise.resolve()

  constructor(
    private readonly pathProvider: IStoragePathService,
    private readonly fileSystem: IFileSystem
  ) {}

  private async getSettingsDirectory(): Promise<string> {
    const sysDir = await this.pathProvider.getActiveVaultSettingsDirectory()
    return path.join(sysDir, 'settings')
  }

  private async writeJsonAtomic(
    fullPath: string,
    settingsMap: Record<string, unknown>
  ): Promise<void> {
    const tmpPath = fullPath + '.tmp'
    await this.fileSystem.writeFile(tmpPath, JSON.stringify(settingsMap, null, 2), 'utf8')
    try {
      await this.fileSystem.rename(tmpPath, fullPath)
    } catch (renameErr: any) {
      if (renameErr.code === 'EXDEV' || renameErr.code === 'EPERM' || renameErr.code === 'EEXIST') {
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

  async writeAllSettings(settingsMap: Record<string, any>): Promise<void> {
    const settingsDir = await this.getSettingsDirectory()
    const grouped = groupSettingsByDomainFile(settingsMap)

    const writeOp = async () => {
      await this.fileSystem.mkdir(settingsDir, { recursive: true })
      for (const [fileName, content] of Object.entries(grouped)) {
        await this.writeJsonAtomic(path.join(settingsDir, fileName), content)
      }
      for (const fileName of SETTINGS_DOMAIN_FILE_NAMES) {
        if (!grouped[fileName]) {
          await this.removeDomainFileIfExists(path.join(settingsDir, fileName))
        }
      }
    }

    const nextLock = this.writeLock.then(writeOp, writeOp)
    this.writeLock = nextLock
    await nextLock
  }

  async readAllSettings(): Promise<Record<string, any>> {
    const snapshot = await this.readAllSettingsForResync()
    return snapshot.settings
  }

  /** 读取磁盘设置快照，并附带各域 JSON 文件的 mtime（用于 SQLite 与磁盘双向合并） */
  async readAllSettingsForResync(): Promise<{
    settings: Record<string, any>
    domainFileMtimeMs: Record<string, number>
  }> {
    const settingsDir = await this.getSettingsDirectory()
    const merged = await this.readMergedFromSettingsDir(settingsDir)
    if (Object.keys(merged).length > 0) {
      return {
        settings: merged,
        domainFileMtimeMs: await this.readDomainFileMtimes(settingsDir)
      }
    }
    const legacy = await this.migrateLegacySettingsIfPresent(settingsDir)
    return {
      settings: legacy,
      domainFileMtimeMs: await this.readDomainFileMtimes(settingsDir)
    }
  }

  private async readDomainFileMtimes(settingsDir: string): Promise<Record<string, number>> {
    const mtimes: Record<string, number> = {}
    try {
      const entries = await this.fileSystem.readdir(settingsDir)
      const jsonFiles = entries.filter(
        (name) =>
          name.endsWith('.json') &&
          !name.endsWith('.tmp') &&
          !name.endsWith(LEGACY_SETTINGS_MIGRATED_SUFFIX)
      )
      for (const fileName of jsonFiles) {
        try {
          const stat = await this.fileSystem.stat(path.join(settingsDir, fileName))
          mtimes[fileName] = stat.mtimeMs ?? 0
        } catch {
          // ignore unreadable stat
        }
      }
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e
    }
    return mtimes
  }

  private async readMergedFromSettingsDir(settingsDir: string): Promise<Record<string, any>> {
    try {
      const entries = await this.fileSystem.readdir(settingsDir)
      const jsonFiles = entries.filter(
        (name) =>
          name.endsWith('.json') &&
          !name.endsWith('.tmp') &&
          !name.endsWith(LEGACY_SETTINGS_MIGRATED_SUFFIX)
      )
      if (jsonFiles.length === 0) return {}

      const merged: Record<string, any> = {}
      for (const fileName of jsonFiles) {
        const filePath = path.join(settingsDir, fileName)
        const content = await this.readJsonFile(filePath)
        Object.assign(merged, content)
      }
      return merged
    } catch (e: any) {
      if (e.code === 'ENOENT') return {}
      throw e
    }
  }

  private async migrateLegacySettingsIfPresent(settingsDir: string): Promise<Record<string, any>> {
    const baishouDir = path.dirname(settingsDir)
    const legacyPath = path.join(baishouDir, LEGACY_SETTINGS_FILENAME)
    if (!(await this.fileSystem.exists(legacyPath))) {
      return {}
    }

    const legacy = await this.readJsonFile(legacyPath)
    if (Object.keys(legacy).length === 0) {
      return {}
    }

    console.warn(
      `[SettingsFileService] Migrating legacy ${LEGACY_SETTINGS_FILENAME} to settings/*.json`
    )
    await this.writeAllSettings(legacy)

    const migratedPath = legacyPath + LEGACY_SETTINGS_MIGRATED_SUFFIX
    try {
      await this.fileSystem.rename(legacyPath, migratedPath)
    } catch {
      try {
        await this.fileSystem.unlink(legacyPath)
      } catch (unlinkErr: any) {
        if (unlinkErr.code !== 'ENOENT') {
          throw unlinkErr
        }
      }
    }

    return legacy
  }

  private async removeDomainFileIfExists(fullPath: string): Promise<void> {
    try {
      await this.fileSystem.unlink(fullPath)
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        throw e
      }
    }
  }

  private async readJsonFile(fullPath: string): Promise<Record<string, any>> {
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
          await this.writeJsonAtomic(fullPath, recovered)
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
