import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssistantManagerService } from '../assistant-manager.service';
import { AssistantRepository } from '@baishou/database/src/repositories/assistant.repository';
import { AssistantFileService } from '../assistant-file.service';

describe('AssistantManagerService (SSOT Enforcer)', () => {
  let mockFileService: import('vitest').Mocked<AssistantFileService>;
  let mockRepo: import('vitest').Mocked<AssistantRepository>;
  let manager: AssistantManagerService;

  beforeEach(() => {
    mockFileService = {
      writeAssistant: vi.fn(),
      readAssistant: vi.fn(),
      deleteAssistant: vi.fn(),
      listAllAssistants: vi.fn(),
    } as any;

    mockRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as any;

    manager = new AssistantManagerService(mockRepo, mockFileService);
  });

  const dummyAssistant = { id: 'ast-1', name: 'My Assistant' };

  it('create() should insert into SQLite and clone to physical JSON file', async () => {
    mockRepo.findById.mockResolvedValue(dummyAssistant as any);

    await manager.create(dummyAssistant as any);

    expect(mockRepo.create).toHaveBeenCalledWith(dummyAssistant);
    expect(mockFileService.writeAssistant).toHaveBeenCalledWith('ast-1', dummyAssistant);
  });

  it('update() should override SQLite and rewrite physical JSON file', async () => {
    mockRepo.findById.mockResolvedValue(dummyAssistant as any);
    
    await manager.update('ast-1', { name: 'New Name' });

    expect(mockRepo.update).toHaveBeenCalledWith('ast-1', { name: 'New Name' });
    expect(mockFileService.writeAssistant).toHaveBeenCalledWith('ast-1', dummyAssistant);
  });

  it('delete() should purge from both sources', async () => {
    await manager.delete('ast-1');

    expect(mockRepo.delete).toHaveBeenCalledWith('ast-1');
    expect(mockFileService.deleteAssistant).toHaveBeenCalledWith('ast-1');
  });

  it('fullResyncFromDisks() synchronizes JSON artifacts back into SQLite', async () => {
    mockFileService.listAllAssistants.mockResolvedValue([{ id: 'ast-1', fullPath: '' }]);
    mockFileService.readAssistant.mockResolvedValue(dummyAssistant);
    mockRepo.findById.mockResolvedValue(null);
    mockRepo.findAll.mockResolvedValue([]);

    await manager.fullResyncFromDisks();

    // The ghost in db should be cleaned, and the valid one should be created.
    expect(mockRepo.create).toHaveBeenCalledWith(dummyAssistant);
  });
});
