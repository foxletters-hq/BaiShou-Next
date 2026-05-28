import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fsp from 'fs/promises'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

vi.mock('electron', () => {
  const mockElectron = {
    app: { getPath: vi.fn().mockReturnValue('/mock/userData') },
    dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() }
  }
  return { ...mockElectron, default: mockElectron }
})

vi.mock('fs', async (importOriginal) => {
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    default: {
      ...actual.default,
      existsSync: vi.fn()
    },
    existsSync: vi.fn(),
    createWriteStream: vi.fn().mockReturnValue({
      on: vi.fn().mockImplementation((event: string, callback: any) => {
        if (event === 'close') setTimeout(callback, 10)
      }),
      once: vi.fn(),
      emit: vi.fn(),
      end: vi.fn()
    })
  }
})

vi.mock('fs/promises', async (importOriginal) => {
  const actual = (await importOriginal()) as any
  const mockReaddir = vi.fn().mockResolvedValue([])
  const mockStat = vi.fn().mockResolvedValue({ mtimeMs: 0, size: 0 })
  const mockUnlink = vi.fn().mockResolvedValue(undefined)
  const mockRename = vi.fn().mockResolvedValue(undefined)
  const mockMkdir = vi.fn().mockResolvedValue(undefined)
  const mockCopyFile = vi.fn().mockResolvedValue(undefined)
  return {
    ...actual,
    default: {
      ...actual.default,
      readdir: mockReaddir,
      stat: mockStat,
      unlink: mockUnlink,
      rename: mockRename,
      mkdir: mockMkdir,
      copyFile: mockCopyFile
    },
    readdir: mockReaddir,
    stat: mockStat,
    unlink: mockUnlink,
    rename: mockRename,
    mkdir: mockMkdir,
    copyFile: mockCopyFile
  }
})

const mockGet = vi.fn().mockResolvedValue(null)
const mockSet = vi.fn()

vi.mock('@baishou/database-desktop', () => {
  class SettingsRepository {
    get = mockGet
    set = mockSet
  }
  class UserProfileRepository {
    getProfile = vi.fn()
    saveProfile = vi.fn()
  }
  return {
    connectionManager: { disconnect: vi.fn() },
    SettingsRepository,
    UserProfileRepository,
    initNodeDatabase: vi.fn()
  }
})

// Mock appDb
vi.mock('../db', () => ({
  appDb: {}
}))

import { DesktopArchiveService } from '../archive.service'

describe('DesktopArchiveService', () => {
  let service: DesktopArchiveService
  let mockPathService: any
  let mockVaultService: any

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(app.getPath).mockReturnValue('/mock/userData')
    vi.mocked(mockGet).mockResolvedValue(null)
    vi.mocked(fsp.unlink).mockResolvedValue(undefined)
    vi.mocked(fsp.mkdir).mockResolvedValue(undefined)
    vi.mocked(fsp.copyFile).mockResolvedValue(undefined)
    vi.mocked(fsp.rename).mockResolvedValue(undefined)
    vi.mocked(fsp.readdir).mockResolvedValue([])
    vi.mocked(fsp.stat).mockResolvedValue({ mtimeMs: 0, size: 0 } as any)

    mockPathService = { getRootDirectory: vi.fn().mockResolvedValue('/mock/root') }
    mockVaultService = { initRegistry: vi.fn().mockResolvedValue(true) }
    service = new DesktopArchiveService(mockPathService, mockVaultService)
  })

  describe('listSnapshots', () => {
    it('should return empty array if directory does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      const res = await service.listSnapshots()
      expect(res).toEqual([])
    })

    it('should return sorted snapshot metadata', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)

      // Return files, some are zip, some are not
      vi.mocked(fsp.readdir).mockResolvedValue(['snap1.zip', 'snap2.zip', 'other.txt'] as any)

      vi.mocked(fsp.stat).mockImplementation(async (filePath) => {
        if (filePath.toString().includes('snap1')) return { mtimeMs: 1000, size: 10 } as any
        if (filePath.toString().includes('snap2')) return { mtimeMs: 2000, size: 20 } as any
        return { mtimeMs: 0, size: 0 } as any
      })

      const res = await service.listSnapshots()

      expect(res).toHaveLength(2)
      expect(res[0].filename).toBe('snap2.zip') // newer first
      expect(res[1].filename).toBe('snap1.zip')
    })
  })

  describe('deleteSnapshot', () => {
    it('should unlink the file if it exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      await service.deleteSnapshot('snap1.zip')

      const expectedPath = path.join('/mock/userData', 'snapshots', 'snap1.zip')
      expect(fsp.unlink).toHaveBeenCalledWith(expectedPath)
    })

    it('should not unlink if file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      await service.deleteSnapshot('snap1.zip')
      expect(fsp.unlink).not.toHaveBeenCalled()
    })
  })

  describe('restoreFromSnapshot', () => {
    it('should throw if snapshot not found', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      await expect(service.restoreFromSnapshot('ghost.zip')).rejects.toThrow('Snapshot not found')
    })

    // Mocking the full importFromZip is tricky because of external deps like extract-zip and sqlite.
    // The main test is that it calls importFromZip with true correctly.
    it('should call importFromZip with creating snapshot before', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      const spy = vi
        .spyOn(service, 'importFromZip')
        .mockResolvedValue({ fileCount: -1, profileRestored: true } as any)

      const res = await service.restoreFromSnapshot('real.zip')
      const expectedPath = path.join('/mock/userData', 'snapshots', 'real.zip')

      expect(spy).toHaveBeenCalledWith(expectedPath, true)
      expect(res.profileRestored).toBe(true)
    })
  })

  describe('createSnapshot limit cleanup', () => {
    it('should clean up old snapshots keeping only the latest 5', async () => {
      vi.spyOn(service, 'exportToTempFile').mockResolvedValue('/mock/temp.zip')
      vi.mocked(fs.existsSync).mockReturnValue(true)

      vi.mocked(fsp.readdir).mockResolvedValue([
        'snapshot_1.zip',
        'snapshot_2.zip',
        'snapshot_3.zip',
        'snapshot_4.zip',
        'snapshot_5.zip',
        'snapshot_6.zip',
        'snapshot_7.zip'
      ] as any)

      vi.mocked(fsp.stat).mockImplementation(async (filePath) => {
        const basename = path.basename(filePath.toString())
        const match = basename.match(/snapshot_(\d+)\.zip/)
        const index = match ? parseInt(match[1]) : 0
        return { mtimeMs: index * 1000, size: 100 } as any
      })

      await service.createSnapshot()

      expect(fsp.copyFile).toHaveBeenCalled()
      expect(fsp.unlink).toHaveBeenCalledWith('/mock/temp.zip')

      const expectedPath1 = path.join('/mock/userData', 'snapshots', 'snapshot_1.zip')
      const expectedPath2 = path.join('/mock/userData', 'snapshots', 'snapshot_2.zip')
      expect(fsp.unlink).toHaveBeenCalledWith(expectedPath1)
      expect(fsp.unlink).toHaveBeenCalledWith(expectedPath2)
    })

    it('should clean up old snapshots keeping custom maxSnapshotCount limit', async () => {
      mockGet.mockResolvedValue({ maxSnapshotCount: 3 })

      vi.spyOn(service, 'exportToTempFile').mockResolvedValue('/mock/temp.zip')
      vi.mocked(fs.existsSync).mockReturnValue(true)

      vi.mocked(fsp.readdir).mockResolvedValue([
        'snapshot_1.zip',
        'snapshot_2.zip',
        'snapshot_3.zip',
        'snapshot_4.zip',
        'snapshot_5.zip'
      ] as any)

      vi.mocked(fsp.stat).mockImplementation(async (filePath) => {
        const basename = path.basename(filePath.toString())
        const match = basename.match(/snapshot_(\d+)\.zip/)
        const index = match ? parseInt(match[1]) : 0
        return { mtimeMs: index * 1000, size: 100 } as any
      })

      await service.createSnapshot()

      const expectedPath1 = path.join('/mock/userData', 'snapshots', 'snapshot_1.zip')
      const expectedPath2 = path.join('/mock/userData', 'snapshots', 'snapshot_2.zip')
      expect(fsp.unlink).toHaveBeenCalledWith(expectedPath1)
      expect(fsp.unlink).toHaveBeenCalledWith(expectedPath2)

      // restore mocked mockResolvedValue
      mockGet.mockResolvedValue(null)
    })
  })

  describe('renameSnapshot', () => {
    it('should rename snapshot if it exists and destination does not', async () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p.toString().includes('old.zip')) return true
        if (p.toString().includes('new.zip')) return false
        return false
      })

      await service.renameSnapshot('old.zip', 'new.zip')

      const expectedOld = path.join('/mock/userData', 'snapshots', 'old.zip')
      const expectedNew = path.join('/mock/userData', 'snapshots', 'new.zip')
      expect(fsp.rename).toHaveBeenCalledWith(expectedOld, expectedNew)
    })

    it('should append .zip if missing', async () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p.toString().includes('old.zip')) return true
        if (p.toString().includes('new.zip')) return false
        return false
      })

      await service.renameSnapshot('old.zip', 'new')

      const expectedOld = path.join('/mock/userData', 'snapshots', 'old.zip')
      const expectedNew = path.join('/mock/userData', 'snapshots', 'new.zip')
      expect(fsp.rename).toHaveBeenCalledWith(expectedOld, expectedNew)
    })

    it('should throw error if source does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      await expect(service.renameSnapshot('ghost.zip', 'new.zip')).rejects.toThrow(
        'Snapshot ghost.zip does not exist.'
      )
    })

    it('should throw error if destination already exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      await expect(service.renameSnapshot('old.zip', 'new.zip')).rejects.toThrow(
        'A snapshot named "new.zip" already exists.'
      )
    })
  })

  describe('batchDeleteSnapshots', () => {
    it('should batch delete existing files', async () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p.toString().includes('file1.zip')) return true
        if (p.toString().includes('file2.zip')) return false
        return false
      })

      const deleted = await service.batchDeleteSnapshots(['file1.zip', 'file2.zip'])
      expect(deleted).toBe(1)
      expect(fsp.unlink).toHaveBeenCalledWith(path.join('/mock/userData', 'snapshots', 'file1.zip'))
    })
  })
})
