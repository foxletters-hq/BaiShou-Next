import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AssistantManagerService } from '../assistant-manager.service'
import { AssistantRepository } from '@baishou/database'
import { AssistantFileService } from '../assistant-file.service'

describe('AssistantManagerService (SSOT Enforcer)', () => {
  let mockFileService: import('vitest').Mocked<AssistantFileService>
  let mockRepo: import('vitest').Mocked<AssistantRepository>
  let manager: AssistantManagerService

  beforeEach(() => {
    mockFileService = {
      writeAssistant: vi.fn(),
      readAssistant: vi.fn(),
      deleteAssistant: vi.fn(),
      listAllAssistants: vi.fn()
    } as any

    mockRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    } as any

    const mockAttachmentManager = {
      importAvatar: vi.fn().mockResolvedValue('avatars/test.jpg'),
      resolveAvatarPath: vi.fn().mockResolvedValue('/abs/path/test.jpg'),
      listOrphans: vi.fn().mockResolvedValue([]),
      deleteBatch: vi.fn().mockResolvedValue(undefined)
    } as any

    manager = new AssistantManagerService(mockRepo, mockFileService, mockAttachmentManager)
  })

  const dummyAssistant = { id: 'ast-1', name: 'My Assistant' }

  it('create() should insert into SQLite and clone to physical JSON file', async () => {
    mockRepo.findAll.mockResolvedValue([])
    mockRepo.findById.mockResolvedValue(dummyAssistant as any)

    await manager.create(dummyAssistant as any)

    expect(mockRepo.create).toHaveBeenCalledWith({ ...dummyAssistant, sortOrder: 0 })
    expect(mockFileService.writeAssistant).toHaveBeenCalledWith('ast-1', {
      ...dummyAssistant,
      assistantKind: 'companion',
      sortOrder: 0,
      avatarPath: undefined
    })
  })

  it('update() should override SQLite and rewrite physical JSON file', async () => {
    mockRepo.findById.mockResolvedValue({
      ...dummyAssistant,
      assistantKind: 'companion',
      sortOrder: 0
    } as any)

    await manager.update('ast-1', { name: 'New Name' })

    expect(mockRepo.update).toHaveBeenCalledWith('ast-1', { name: 'New Name' })
    expect(mockFileService.writeAssistant).toHaveBeenCalledWith('ast-1', {
      ...dummyAssistant,
      name: 'My Assistant',
      assistantKind: 'companion',
      sortOrder: 0,
      avatarPath: undefined
    })
  })

  it('delete() should purge from both sources', async () => {
    await manager.delete('ast-1')

    expect(mockRepo.delete).toHaveBeenCalledWith('ast-1')
    expect(mockFileService.deleteAssistant).toHaveBeenCalledWith('ast-1')
  })

  it('fullResyncFromDisks() skips stale JSON when SQLite is newer', async () => {
    mockFileService.listAllAssistants.mockResolvedValue([{ id: 'ast-1', fullPath: '' }])
    mockFileService.readAssistant.mockResolvedValue({
      ...dummyAssistant,
      avatarPath: 'builtin-assistant:assistant-preset-1',
      updatedAt: '2026-06-16T10:00:00.000Z'
    })
    mockRepo.findById.mockResolvedValue({
      ...dummyAssistant,
      avatarPath: 'avatars/new.jpg',
      updatedAt: new Date('2026-06-16T12:00:00.000Z')
    } as any)
    mockRepo.findAll.mockResolvedValue([
      {
        ...dummyAssistant,
        avatarPath: 'avatars/new.jpg',
        updatedAt: new Date('2026-06-16T12:00:00.000Z')
      }
    ] as any)

    await manager.fullResyncFromDisks()

    expect(mockRepo.update).not.toHaveBeenCalled()
  })

  it('fullResyncFromDisks() synchronizes JSON artifacts back into SQLite', async () => {
    mockFileService.listAllAssistants.mockResolvedValue([{ id: 'ast-1', fullPath: '' }])
    mockFileService.readAssistant.mockResolvedValue(dummyAssistant)
    mockRepo.findById.mockResolvedValue(null as any)
    mockRepo.findAll.mockResolvedValue([])

    await manager.fullResyncFromDisks()

    // The ghost in db should be cleaned, and the valid one should be created.
    expect(mockRepo.create).toHaveBeenCalledWith(dummyAssistant)
  })

  it('fullResyncFromDisks() rebuilds the assistant cache from the active vault disk', async () => {
    mockFileService.listAllAssistants.mockResolvedValue([])
    mockRepo.findAll.mockResolvedValue([{ id: 'ast-other', name: 'Other' } as any])

    await manager.fullResyncFromDisks({ activeVaultName: 'Personal' })

    expect(mockRepo.delete).toHaveBeenCalledWith('ast-other')
  })
})
