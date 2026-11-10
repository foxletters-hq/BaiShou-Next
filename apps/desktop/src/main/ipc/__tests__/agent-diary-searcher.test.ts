import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  sendMock,
  getAllWindowsMock,
  getActiveVaultMock,
  getDiaryManagerMock,
  getDiaryManagerForVaultMock,
  createMock,
  updateMock,
  deleteMock,
  findByDateMock
} = vi.hoisted(() => ({
  sendMock: vi.fn(),
  getAllWindowsMock: vi.fn(),
  getActiveVaultMock: vi.fn(),
  getDiaryManagerMock: vi.fn(),
  getDiaryManagerForVaultMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  findByDateMock: vi.fn()
}))

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: getAllWindowsMock
  }
}))

vi.mock('@baishou/database-desktop', () => ({
  ShadowIndexRepository: class {
    searchFTS = vi.fn().mockResolvedValue([])
    findByDateRange = vi.fn().mockResolvedValue([])
  },
  shadowConnectionManager: {
    getDb: vi.fn(() => ({}))
  }
}))

vi.mock('../vault.ipc', () => ({
  getActiveVaultShadowRepo: vi.fn(() => ({
    searchFTS: vi.fn().mockResolvedValue([]),
    findByDateRange: vi.fn().mockResolvedValue([])
  })),
  resolveVaultIdByName: vi.fn((name: string) => `vlt_${name}`),
  vaultService: {
    getActiveVault: getActiveVaultMock
  }
}))

vi.mock('../diary.ipc', () => ({
  getDiaryManager: getDiaryManagerMock
}))

vi.mock('../../services/diary-vault.factory', () => ({
  getDiaryManagerForVault: getDiaryManagerForVaultMock
}))

import { createDiarySearcher } from '../agent-diary-searcher'

describe('createDiarySearcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAllWindowsMock.mockReturnValue([
      {
        isDestroyed: () => false,
        webContents: { send: sendMock }
      }
    ])
    getActiveVaultMock.mockReturnValue({ id: 'vlt_personal', name: 'Personal' })
    const fakeDiaryService = {
      create: createMock,
      update: updateMock,
      delete: deleteMock,
      findByDate: findByDateMock
    }
    getDiaryManagerMock.mockReturnValue(fakeDiaryService)
    getDiaryManagerForVaultMock.mockResolvedValue(fakeDiaryService)
  })

  it('should use active getDiaryManager when targetVaultName matches active vault case-insensitively', async () => {
    createMock.mockResolvedValue({
      id: 101,
      date: new Date('2026-11-10T00:00:00.000Z'),
      content: '今日日记正文',
      updatedAt: new Date('2026-11-10T03:55:23.691Z')
    })

    const searcher = createDiarySearcher({ vaultId: 'vlt_personal', vaultName: 'personal' })
    const result = await searcher!.writeEntry('2026-11-10', '今日日记正文')

    expect(result).toEqual({ ok: true })
    expect(getDiaryManagerMock).toHaveBeenCalledTimes(1)
    expect(getDiaryManagerForVaultMock).not.toHaveBeenCalled()
  })

  it('should broadcast diary:sync-event to renderer windows when writeEntry, editEntry, or deleteEntry succeeds', async () => {
    createMock.mockResolvedValue({
      id: 102,
      date: new Date('2026-11-10T00:00:00.000Z'),
      content: '新建日记',
      updatedAt: new Date('2026-11-10T03:55:23.691Z')
    })
    findByDateMock.mockResolvedValue({
      id: 102,
      date: new Date('2026-11-10T00:00:00.000Z'),
      content: '新建日记'
    })
    updateMock.mockResolvedValue({
      id: 102,
      date: new Date('2026-11-10T00:00:00.000Z'),
      content: '新建日记\n\n追加段落',
      updatedAt: new Date('2026-11-10T04:00:00.000Z')
    })
    deleteMock.mockResolvedValue(undefined)

    const searcher = createDiarySearcher({ vaultId: 'vlt_personal', vaultName: 'Personal' })

    await searcher!.writeEntry('2026-11-10', '新建日记')
    expect(sendMock).toHaveBeenCalledWith(
      'diary:sync-event',
      expect.objectContaining({
        type: 'saved',
        date: '2026-11-10',
        entry: expect.objectContaining({ id: 102 })
      })
    )

    sendMock.mockClear()
    await searcher!.editEntry({ date: '2026-11-10', content: '追加段落', mode: 'append' })
    expect(sendMock).toHaveBeenCalledWith(
      'diary:sync-event',
      expect.objectContaining({
        type: 'saved',
        date: '2026-11-10',
        entry: expect.objectContaining({ id: 102 })
      })
    )

    sendMock.mockClear()
    await searcher!.deleteEntry('2026-11-10')
    expect(sendMock).toHaveBeenCalledWith(
      'diary:sync-event',
      expect.objectContaining({
        type: 'deleted',
        date: '2026-11-10'
      })
    )
  })
})
