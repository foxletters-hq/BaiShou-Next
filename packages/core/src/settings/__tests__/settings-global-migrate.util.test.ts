import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as nodePath from 'node:path'
import type { IFileSystem } from '../../fs/file-system.types'
import * as path from '../../fs/path.util'
import {
  migrateVaultSettingsToGlobal,
  VAULT_SETTINGS_DIR_MIGRATED_NAME
} from '../settings-global-migrate.util'
import { SettingsFileService } from '../settings-file.service'
import type { IStoragePathService } from '../../vault/storage-path.types'

function createNodeFileSystem(): IFileSystem {
  return {
    exists: async (p) => {
      try {
        await fs.access(p)
        return true
      } catch {
        return false
      }
    },
    mkdir: (p, options) => fs.mkdir(p, options),
    readFile: (p) => fs.readFile(p, 'utf8'),
    writeFile: (p, data) => fs.writeFile(p, data, 'utf8'),
    appendFile: (p, data) => fs.appendFile(p, data, 'utf8'),
    unlink: (p) => fs.unlink(p),
    readdir: (p) => fs.readdir(p),
    stat: async (p) => {
      const st = await fs.stat(p)
      return {
        isFile: st.isFile(),
        isDirectory: st.isDirectory(),
        size: st.size,
        mtimeMs: st.mtimeMs
      }
    },
    rename: (from, to) => fs.rename(from, to),
    rm: (p, options) => fs.rm(p, options),
    copyFile: (src, dest) => fs.cp(src, dest, { recursive: true })
  }
}

describe('migrateVaultSettingsToGlobal', () => {
  let tempRoot: string
  let fileSystem: IFileSystem

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'baishou-settings-v15-'))
    fileSystem = createNodeFileSystem()
  })

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true })
  })

  async function writeVaultSettings(vaultName: string, content: Record<string, unknown>) {
    const dir = path.join(tempRoot, vaultName, '.baishou', 'settings')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(
      path.join(dir, 'app_preferences.json'),
      JSON.stringify(content, null, 2),
      'utf8'
    )
  }

  it('moves active vault settings to storage root and retires other vault copies', async () => {
    await writeVaultSettings('Personal', { theme: 'dark', language: 'zh' })
    await writeVaultSettings('Work', { theme: 'light', language: 'en' })

    const globalDir = path.join(tempRoot, '.baishou', 'settings')
    const result = await migrateVaultSettingsToGlobal({
      fileSystem,
      rootDirectory: tempRoot,
      globalSettingsDirectory: globalDir,
      activeVaultPath: path.join(tempRoot, 'Personal')
    })

    expect(result.movedFromActive).toBe(true)
    expect(result.retiredSettingsDirCount).toBe(1)
    expect(await fileSystem.exists(path.join(globalDir, 'app_preferences.json'))).toBe(true)
    const globalRaw = await fs.readFile(path.join(globalDir, 'app_preferences.json'), 'utf8')
    expect(JSON.parse(globalRaw)).toEqual({ theme: 'dark', language: 'zh' })

    expect(await fileSystem.exists(path.join(tempRoot, 'Personal', '.baishou', 'settings'))).toBe(
      false
    )
    expect(
      await fileSystem.exists(
        path.join(tempRoot, 'Work', '.baishou', VAULT_SETTINGS_DIR_MIGRATED_NAME)
      )
    ).toBe(true)
  })

  it('is idempotent on second run', async () => {
    await writeVaultSettings('Personal', { theme: 'dark' })
    const globalDir = path.join(tempRoot, '.baishou', 'settings')
    const opts = {
      fileSystem,
      rootDirectory: tempRoot,
      globalSettingsDirectory: globalDir,
      activeVaultPath: path.join(tempRoot, 'Personal')
    }

    await migrateVaultSettingsToGlobal(opts)
    const second = await migrateVaultSettingsToGlobal(opts)

    expect(second).toEqual({
      movedFromActive: false,
      retiredSettingsDirCount: 0,
      retiredLegacyFileCount: 0
    })
    expect(await fileSystem.exists(path.join(globalDir, 'app_preferences.json'))).toBe(true)
  })

  it('keeps existing global settings and only retires vault leftovers', async () => {
    const globalDir = path.join(tempRoot, '.baishou', 'settings')
    await fs.mkdir(globalDir, { recursive: true })
    await fs.writeFile(
      path.join(globalDir, 'app_preferences.json'),
      JSON.stringify({ theme: 'global' }, null, 2),
      'utf8'
    )
    await writeVaultSettings('Personal', { theme: 'vault' })

    const result = await migrateVaultSettingsToGlobal({
      fileSystem,
      rootDirectory: tempRoot,
      globalSettingsDirectory: globalDir,
      activeVaultPath: path.join(tempRoot, 'Personal')
    })

    expect(result.movedFromActive).toBe(false)
    expect(result.retiredSettingsDirCount).toBe(1)
    const globalRaw = await fs.readFile(path.join(globalDir, 'app_preferences.json'), 'utf8')
    expect(JSON.parse(globalRaw)).toEqual({ theme: 'global' })
  })

  it('SettingsFileService keeps reading the same settings after vault switch path', async () => {
    await writeVaultSettings('Personal', { theme: 'dark', language: 'zh' })
    const globalDir = path.join(tempRoot, '.baishou', 'settings')

    const pathProvider = {
      getRootDirectory: async () => tempRoot,
      getGlobalSettingsDirectory: async () => globalDir,
      getActiveVaultPath: async () => path.join(tempRoot, 'Personal')
    } as unknown as IStoragePathService

    const service = new SettingsFileService(pathProvider, fileSystem)
    const first = await service.readAllSettings()
    expect(first).toEqual({ theme: 'dark', language: 'zh' })

    // 模拟切换活跃仓：路径服务指向 Work，但全局设置应仍可读
    ;(pathProvider.getActiveVaultPath as any) = async () => path.join(tempRoot, 'Work')
    const second = await service.readAllSettings()
    expect(second).toEqual({ theme: 'dark', language: 'zh' })
  })
})
