import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as path from '../../fs/path.util'
import { SettingsFileService } from '../settings-file.service'
import { IStoragePathService } from '../../vault/storage-path.types'
import type { IFileSystem } from '../../fs'

function settingsFilePath(settingsDir: string, fileName: string) {
  return path.join(settingsDir, fileName)
}

function tmpPath(settingsDir: string, fileName: string) {
  return settingsFilePath(settingsDir, fileName) + '.tmp'
}

describe('SettingsFileService', () => {
  let service: SettingsFileService
  const rootDir = '/storage-root'
  const globalSettingsDir = '/storage-root/.baishou/settings'
  let mockFileSystem: IFileSystem
  let mockPathProvider: IStoragePathService

  beforeEach(() => {
    mockFileSystem = {
      exists: vi.fn().mockResolvedValue(false),
      mkdir: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn().mockResolvedValue(undefined),
      appendFile: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn(),
      readdir: vi.fn().mockImplementation(async (dir: string) => {
        if (dir === rootDir) return []
        const err = new Error('ENOENT') as NodeJS.ErrnoException
        err.code = 'ENOENT'
        throw err
      }),
      stat: vi.fn(),
      rename: vi.fn().mockResolvedValue(undefined),
      rm: vi.fn(),
      copyFile: vi.fn()
    }

    mockPathProvider = {
      getRootDirectory: vi.fn().mockResolvedValue(rootDir),
      getGlobalSettingsDirectory: vi.fn().mockResolvedValue(globalSettingsDir),
      getActiveVaultPath: vi.fn().mockResolvedValue(null)
    } as unknown as IStoragePathService

    service = new SettingsFileService(mockPathProvider, mockFileSystem)
  })

  describe('writeAllSettings', () => {
    it('should write domain files to tmp then rename atomically', async () => {
      const settings = { theme: 'dark', language: 'zh' }

      await service.writeAllSettings(settings)

      expect(mockFileSystem.mkdir).toHaveBeenCalledWith(globalSettingsDir, {
        recursive: true
      })
      expect(mockFileSystem.writeFile).toHaveBeenCalledTimes(1)
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        tmpPath(globalSettingsDir, 'app_preferences.json'),
        JSON.stringify({ language: 'zh', theme: 'dark' }, null, 2),
        'utf8'
      )

      expect(mockFileSystem.rename).toHaveBeenCalledTimes(1)
      expect(mockFileSystem.rename).toHaveBeenCalledWith(
        tmpPath(globalSettingsDir, 'app_preferences.json'),
        settingsFilePath(globalSettingsDir, 'app_preferences.json')
      )
    })

    it('should skip rewrite when domain file content is unchanged', async () => {
      const settings = { language: 'zh', theme: 'dark' }
      vi.mocked(mockFileSystem.readFile).mockResolvedValue(
        JSON.stringify({ theme: 'dark', language: 'zh' }, null, 2)
      )

      await service.writeAllSettings(settings)

      expect(mockFileSystem.writeFile).not.toHaveBeenCalled()
      expect(mockFileSystem.rename).not.toHaveBeenCalled()
    })

    it('should serialize concurrent writes via write lock', async () => {
      const settings1 = { key: 'first' }
      const settings2 = { key: 'second' }

      let resolveFirst: () => void
      let resolveRename: () => void
      const firstWritePromise = new Promise<void>((r) => {
        resolveFirst = r
      })
      const firstRenamePromise = new Promise<void>((r) => {
        resolveRename = r
      })
      vi.mocked(mockFileSystem.writeFile).mockReturnValueOnce(firstWritePromise)
      vi.mocked(mockFileSystem.rename).mockReturnValueOnce(firstRenamePromise)

      const p1 = service.writeAllSettings(settings1)
      await new Promise((r) => setTimeout(r, 0))
      const p2 = service.writeAllSettings(settings2)
      await new Promise((r) => setTimeout(r, 0))

      expect(mockFileSystem.writeFile).toHaveBeenCalledTimes(1)

      resolveFirst!()
      resolveRename!()
      await p1
      await p2

      expect(mockFileSystem.writeFile).toHaveBeenCalledTimes(2)
      expect(mockFileSystem.rename).toHaveBeenCalledTimes(2)
    })

    it('should split known keys into dedicated domain files', async () => {
      await service.writeAllSettings({
        ai_providers: [{ id: 'openai' }],
        global_models: { chat: 'gpt-4' },
        cloud_sync_config: { target: 's3' }
      })

      expect(mockFileSystem.writeFile).toHaveBeenCalledTimes(2)
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        tmpPath(globalSettingsDir, 'ai_providers.json'),
        JSON.stringify({ ai_providers: [{ id: 'openai' }] }, null, 2),
        'utf8'
      )
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        tmpPath(globalSettingsDir, 'global_models.json'),
        JSON.stringify({ global_models: { chat: 'gpt-4' } }, null, 2),
        'utf8'
      )
    })

    it('should remove empty domain files when all keys in that domain are deleted', async () => {
      vi.mocked(mockFileSystem.readdir).mockImplementation(async (dir: string) => {
        if (dir === rootDir) return []
        if (dir === globalSettingsDir) return ['app_preferences.json']
        const err = new Error('ENOENT') as NodeJS.ErrnoException
        err.code = 'ENOENT'
        throw err
      })

      await service.writeAllSettings({ theme: 'dark' })
      vi.mocked(mockFileSystem.unlink).mockClear()

      await service.writeAllSettings({})

      expect(mockFileSystem.unlink).toHaveBeenCalledWith(
        settingsFilePath(globalSettingsDir, 'app_preferences.json')
      )
    })
  })

  describe('readAllSettings', () => {
    it('should merge all domain files', async () => {
      vi.mocked(mockFileSystem.readdir).mockImplementation(async (dir: string) => {
        if (dir === rootDir) return []
        if (dir === globalSettingsDir) return ['ai_providers.json', 'app_preferences.json']
        const err = new Error('ENOENT') as NodeJS.ErrnoException
        err.code = 'ENOENT'
        throw err
      })
      vi.mocked(mockFileSystem.readFile).mockImplementation(async (filePath: string) => {
        if (filePath.endsWith('ai_providers.json')) {
          return JSON.stringify({ ai_providers: [{ id: 'openai' }] })
        }
        return JSON.stringify({ theme: 'light' })
      })

      const result = await service.readAllSettings()

      expect(result).toEqual({
        ai_providers: [{ id: 'openai' }],
        theme: 'light'
      })
    })

    it('should return empty object when settings directory is empty', async () => {
      vi.mocked(mockFileSystem.readdir).mockImplementation(async (dir: string) => {
        if (dir === rootDir) return []
        if (dir === globalSettingsDir) return []
        const err = new Error('ENOENT') as NodeJS.ErrnoException
        err.code = 'ENOENT'
        throw err
      })

      const result = await service.readAllSettings()

      expect(result).toEqual({})
    })

    it('should return empty object when settings directory does not exist', async () => {
      const err = new Error('ENOENT') as NodeJS.ErrnoException
      err.code = 'ENOENT'
      vi.mocked(mockFileSystem.readdir).mockImplementation(async (dir: string) => {
        if (dir === rootDir) return []
        throw err
      })

      const result = await service.readAllSettings()

      expect(result).toEqual({})
    })

    it('should attempt recovery when JSON is corrupted with trailing garbage', async () => {
      const validPart = { theme: 'dark', lang: 'zh' }
      const corrupted = JSON.stringify(validPart) + '\n"S"\n  }\n}'
      vi.mocked(mockFileSystem.readdir).mockImplementation(async (dir: string) => {
        if (dir === rootDir) return []
        if (dir === globalSettingsDir) return ['app_preferences.json']
        const err = new Error('ENOENT') as NodeJS.ErrnoException
        err.code = 'ENOENT'
        throw err
      })
      vi.mocked(mockFileSystem.readFile).mockResolvedValue(corrupted)

      const result = await service.readAllSettings()

      expect(result).toEqual(validPart)
      expect(mockFileSystem.writeFile).toHaveBeenCalledTimes(1)
    })

    it('should return empty object when JSON is completely unrecoverable', async () => {
      vi.mocked(mockFileSystem.readdir).mockImplementation(async (dir: string) => {
        if (dir === rootDir) return []
        if (dir === globalSettingsDir) return ['app_preferences.json']
        const err = new Error('ENOENT') as NodeJS.ErrnoException
        err.code = 'ENOENT'
        throw err
      })
      vi.mocked(mockFileSystem.readFile).mockResolvedValue('{ this is not json at all [')

      const result = await service.readAllSettings()

      expect(result).toEqual({})
      expect(mockFileSystem.writeFile).not.toHaveBeenCalled()
    })

    it('should migrate legacy settings.json when settings directory is empty', async () => {
      const legacy = { theme: 'dark', language: 'zh' }
      vi.mocked(mockFileSystem.readdir).mockImplementation(async (dir: string) => {
        if (dir === rootDir) return []
        if (dir === globalSettingsDir) return []
        const err = new Error('ENOENT') as NodeJS.ErrnoException
        err.code = 'ENOENT'
        throw err
      })
      vi.mocked(mockFileSystem.exists).mockImplementation(async (filePath: string) =>
        filePath.endsWith('settings.json')
      )
      vi.mocked(mockFileSystem.readFile).mockImplementation(async (filePath: string) => {
        if (filePath.endsWith('settings.json')) {
          return JSON.stringify(legacy)
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      })

      const result = await service.readAllSettings()

      expect(result).toEqual(legacy)
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        tmpPath(globalSettingsDir, 'app_preferences.json'),
        JSON.stringify({ language: 'zh', theme: 'dark' }, null, 2),
        'utf8'
      )
      expect(mockFileSystem.rename).toHaveBeenCalledWith(
        path.join('/storage-root/.baishou', 'settings.json'),
        path.join('/storage-root/.baishou', 'settings.json.migrated')
      )
    })
  })
})
