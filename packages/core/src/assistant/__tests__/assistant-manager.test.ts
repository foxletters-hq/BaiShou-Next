import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AssistantManagerService } from '../assistant-manager.service'
import { AssistantRepository } from '@baishou/database'
import { AssistantFileService } from '../assistant-file.service'

describe('AssistantManagerService (SSOT Enforcer)', () => {
  let mockFileService: import('vitest').Mocked<AssistantFileService>
  let mockRepo: import('vitest').Mocked<AssistantRepository>
  let mockAttachmentManager: {
    importAvatar: ReturnType<typeof vi.fn>
    resolveAvatarPath: ReturnType<typeof vi.fn>
    deleteAvatar: ReturnType<typeof vi.fn>
    listOrphans: ReturnType<typeof vi.fn>
    deleteBatch: ReturnType<typeof vi.fn>
  }
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

    mockAttachmentManager = {
      importAvatar: vi.fn().mockResolvedValue('avatars/test.jpg'),
      resolveAvatarPath: vi.fn().mockResolvedValue('/abs/path/test.jpg'),
      deleteAvatar: vi.fn().mockResolvedValue(true),
      listOrphans: vi.fn().mockResolvedValue([]),
      deleteBatch: vi.fn().mockResolvedValue(undefined)
    }

    manager = new AssistantManagerService(mockRepo, mockFileService, mockAttachmentManager as any)
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

  it('update() deletes previous custom avatar when replaced', async () => {
    mockRepo.findById
      .mockResolvedValueOnce({
        ...dummyAssistant,
        avatarPath: 'avatars/agent_old.jpg'
      } as any)
      .mockResolvedValue({
        ...dummyAssistant,
        avatarPath: 'avatars/agent_new.jpg',
        assistantKind: 'companion',
        sortOrder: 0
      } as any)
    mockRepo.findAll.mockResolvedValue([
      { id: 'ast-1', avatarPath: 'avatars/agent_new.jpg' }
    ] as any)
    mockAttachmentManager.importAvatar.mockResolvedValue('avatars/agent_new.jpg')

    await manager.update('ast-1', { avatarPath: 'data:image/png;base64,abc' })

    expect(mockAttachmentManager.deleteAvatar).toHaveBeenCalledWith('avatars/agent_old.jpg')
  })

  it('update() keeps previous custom avatar when another assistant still references it', async () => {
    mockRepo.findById
      .mockResolvedValueOnce({
        ...dummyAssistant,
        avatarPath: 'avatars/agent_shared.jpg'
      } as any)
      .mockResolvedValue({
        ...dummyAssistant,
        avatarPath: 'builtin-assistant:assistant-preset-1',
        assistantKind: 'companion',
        sortOrder: 0
      } as any)
    mockRepo.findAll.mockResolvedValue([
      { id: 'ast-1', avatarPath: 'builtin-assistant:assistant-preset-1' },
      { id: 'ast-2', avatarPath: 'avatars/agent_shared.jpg' }
    ] as any)

    await manager.update('ast-1', { avatarPath: 'builtin-assistant:assistant-preset-1' })

    expect(mockAttachmentManager.deleteAvatar).not.toHaveBeenCalled()
  })

  it('delete() should purge from both sources and remove custom avatar file', async () => {
    mockRepo.findById.mockResolvedValue({
      ...dummyAssistant,
      avatarPath: 'avatars/agent_gone.jpg'
    } as any)
    mockRepo.findAll.mockResolvedValue([])

    await manager.delete('ast-1')

    expect(mockRepo.delete).toHaveBeenCalledWith('ast-1')
    expect(mockFileService.deleteAssistant).toHaveBeenCalledWith('ast-1')
    expect(mockAttachmentManager.deleteAvatar).toHaveBeenCalledWith('avatars/agent_gone.jpg')
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
