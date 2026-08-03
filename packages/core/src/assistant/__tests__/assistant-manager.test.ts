import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deriveLegacyVaultId } from '@baishou/shared'
import { AssistantManagerService } from '../assistant-manager.service'
import { AssistantRepository } from '@baishou/database'
import { AssistantFileService } from '../assistant-file.service'

const VAULT_PERSONAL = deriveLegacyVaultId('Personal')

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
      listAllAssistants: vi.fn(),
      listAssistantsAcrossVaults: vi.fn()
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

    manager = new AssistantManagerService(
      mockRepo,
      mockFileService,
      mockAttachmentManager as any,
      () => VAULT_PERSONAL
    )
  })

  const dummyAssistant = { id: 'ast-1', name: 'My Assistant' }

  it('create() should insert into SQLite and clone to physical JSON file', async () => {
    mockRepo.findAll.mockResolvedValue([])
    mockRepo.findById.mockResolvedValue(dummyAssistant as any)

    await manager.create(dummyAssistant as any)

    expect(mockRepo.create).toHaveBeenCalledWith({
      ...dummyAssistant,
      vaultId: VAULT_PERSONAL,
      sortOrder: 0
    })
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

    expect(mockRepo.update).toHaveBeenCalledWith('ast-1', { name: 'New Name' }, VAULT_PERSONAL)
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

    expect(mockRepo.delete).toHaveBeenCalledWith('ast-1', VAULT_PERSONAL)
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

    await manager.fullResyncFromDisks({ activeVaultId: VAULT_PERSONAL })

    expect(mockRepo.update).not.toHaveBeenCalled()
  })

  it('fullResyncFromDisks() synchronizes JSON artifacts back into SQLite', async () => {
    mockFileService.listAllAssistants.mockResolvedValue([{ id: 'ast-1', fullPath: '' }])
    mockFileService.readAssistant.mockResolvedValue(dummyAssistant)
    mockRepo.findById.mockResolvedValue(null as any)
    mockRepo.findAll.mockResolvedValue([])

    await manager.fullResyncFromDisks({ activeVaultId: VAULT_PERSONAL })

    expect(mockRepo.create).toHaveBeenCalledWith({
      ...dummyAssistant,
      vaultId: VAULT_PERSONAL
    })
  })

  it('fullResyncFromDisks() only deletes ghosts within the active vault', async () => {
    mockFileService.listAllAssistants.mockResolvedValue([])
    mockRepo.findAll.mockResolvedValue([{ id: 'ast-other', name: 'Other' } as any])

    await manager.fullResyncFromDisks({
      activeVaultName: 'Personal',
      activeVaultId: VAULT_PERSONAL
    })

    expect(mockRepo.findAll).toHaveBeenCalledWith(VAULT_PERSONAL)
    expect(mockRepo.delete).toHaveBeenCalledWith('ast-other', VAULT_PERSONAL)
  })

  it('fullResyncFromDisks() does not wipe other vault rows when scanning one vault', async () => {
    const vaultWork = deriveLegacyVaultId('Work')
    mockFileService.listAllAssistants.mockResolvedValue([])
    mockRepo.findAll.mockImplementation(async (vaultId?: string | null) => {
      if (vaultId === VAULT_PERSONAL) return [{ id: 'ast-personal', name: 'P' } as any]
      if (vaultId === vaultWork) return [{ id: 'ast-work', name: 'W' } as any]
      return []
    })

    await manager.fullResyncFromDisks({
      activeVaultId: VAULT_PERSONAL,
      activeVaultName: 'Personal'
    })

    expect(mockRepo.delete).toHaveBeenCalledWith('ast-personal', VAULT_PERSONAL)
    expect(mockRepo.delete).not.toHaveBeenCalledWith('ast-work', vaultWork)
  })
})
