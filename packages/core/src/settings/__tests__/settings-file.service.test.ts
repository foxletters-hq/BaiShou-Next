import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as path from '../../fs/path.util'
import { SettingsFileService } from '../settings-file.service'
import { IStoragePathService } from '../../vault/storage-path.types'
import type { IFileSystem } from '../../fs'

function settingsPath(sysDir: string) {
  return path.join(sysDir, 'settings.json')
}

function tmpPath(sysDir: string) {
  return path.join(sysDir, 'settings.json.tmp')
}

describe('SettingsFileService', () => {
  let service: SettingsFileService
  const sysDir = '/vault/.baishou'
  let mockFileSystem: IFileSystem

  beforeEach(() => {
    mockFileSystem = {
      exists: vi.fn(),
      mkdir: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
      rename: vi.fn().mockResolvedValue(undefined),
      rm: vi.fn(),
      copyFile: vi.fn()
    }

    const mockPathProvider = {
      getVaultSystemDirectory: vi.fn().mockResolvedValue(sysDir)
    } as unknown as IStoragePathService

    service = new SettingsFileService(mockPathProvider, mockFileSystem)
  })

  describe('writeAllSettings', () => {
    it('should write to tmp file then rename atomically', async () => {
      const settings = { theme: 'dark', language: 'zh' }

      await service.writeAllSettings(settings)

      expect(mockFileSystem.writeFile).toHaveBeenCalledTimes(1)
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        tmpPath(sysDir),
        JSON.stringify(settings, null, 2),
        'utf8'
      )

      expect(mockFileSystem.rename).toHaveBeenCalledTimes(1)
      expect(mockFileSystem.rename).toHaveBeenCalledWith(tmpPath(sysDir), settingsPath(sysDir))
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
  })

  describe('readAllSettings', () => {
    it('should return parsed settings when file is valid', async () => {
      const settings = { theme: 'light', fontSize: 14 }
      vi.mocked(mockFileSystem.readFile).mockResolvedValue(JSON.stringify(settings))

      const result = await service.readAllSettings()

      expect(result).toEqual(settings)
    })

    it('should return empty object when file is empty', async () => {
      vi.mocked(mockFileSystem.readFile).mockResolvedValue('')

      const result = await service.readAllSettings()

      expect(result).toEqual({})
    })

    it('should return empty object when file does not exist', async () => {
      const err = new Error('ENOENT') as NodeJS.ErrnoException
      err.code = 'ENOENT'
      vi.mocked(mockFileSystem.readFile).mockRejectedValue(err)

      const result = await service.readAllSettings()

      expect(result).toEqual({})
    })

    it('should attempt recovery when JSON is corrupted with trailing garbage', async () => {
      const validPart = { theme: 'dark', lang: 'zh' }
      const corrupted = JSON.stringify(validPart) + '\n"S"\n  }\n}'
      vi.mocked(mockFileSystem.readFile).mockResolvedValue(corrupted)

      const result = await service.readAllSettings()

      expect(result).toEqual(validPart)
      expect(mockFileSystem.writeFile).toHaveBeenCalledTimes(1)
    })

    it('should return empty object when JSON is completely unrecoverable', async () => {
      vi.mocked(mockFileSystem.readFile).mockResolvedValue('{ this is not json at all [')

      const result = await service.readAllSettings()

      expect(result).toEqual({})
      expect(mockFileSystem.writeFile).not.toHaveBeenCalled()
    })
  })
})
