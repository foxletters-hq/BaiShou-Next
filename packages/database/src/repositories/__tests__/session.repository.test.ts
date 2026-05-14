import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionRepository } from '../session.repository';
import { AppDatabase } from '../../types';

describe('SessionRepository', () => {
  let db: unknown;
  let repo: SessionRepository;

  // Global Mock Builders
  let mockInsert: any;
  let mockUpdate: any;
  let mockDelete: any;
  let mockValues: any;
  let mockOnConflictDoUpdate: any;
  let mockSet: any;
  let mockWhere: any;
  let mockSelect: any;
  let mockFrom: any;
  let mockOrderBy: any;
  let mockOffset: any;

  beforeEach(() => {
    vi.resetAllMocks();

    mockValues = vi.fn().mockReturnThis();
    mockOnConflictDoUpdate = vi.fn().mockResolvedValue([]);
    
    mockInsert = vi.fn().mockReturnValue({
      values: mockValues,
      onConflictDoUpdate: mockOnConflictDoUpdate
    });

    mockSet = vi.fn().mockReturnThis();
    mockWhere = vi.fn().mockResolvedValue([]);
    mockUpdate = vi.fn().mockReturnValue({
      set: mockSet,
      where: mockWhere
    });

    mockDelete = vi.fn().mockReturnValue({
      where: mockWhere
    });

    mockOffset = vi.fn().mockResolvedValue([]);
    mockOrderBy = vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({ offset: mockOffset })
    });
    const mockWhereLimit = vi.fn().mockResolvedValue([{ id: 'm2', orderIndex: 2, sessionId: 's1' }]);
    
    const mockWhereChain = vi.fn().mockReturnValue({
       limit: mockWhereLimit,
       orderBy: mockOrderBy
    });

    mockFrom = vi.fn().mockReturnValue({
      where: mockWhereChain,
      orderBy: mockOrderBy
    });
    mockSelect = vi.fn().mockReturnValue({
      from: mockFrom
    });

    db = {
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      select: mockSelect,
      transaction: vi.fn().mockImplementation(async (cb) => {
        // Transaction provides a 'tx' that behaves like 'db' — select/delete chains return arrays
        const txWhere = vi.fn().mockResolvedValue([]);
        const txFrom = vi.fn().mockReturnValue({ where: txWhere, orderBy: vi.fn().mockResolvedValue([]) });
        const txSelect = vi.fn().mockReturnValue({ from: txFrom });
        const txDeleteWhere = vi.fn().mockResolvedValue(undefined);
        const txDelete = vi.fn().mockReturnValue({ where: txDeleteWhere });
        const tx = { select: txSelect, delete: txDelete, insert: mockInsert, update: mockUpdate };
        return await cb(tx);
      })
    };

    repo = new SessionRepository(db as AppDatabase);
  });

  describe('findAllSessions', () => {
    it('should return all sessions sorted by isPinned and updatedAt', async () => {
      mockOffset.mockResolvedValueOnce([
        { id: 's1', isPinned: true },
        { id: 's2', isPinned: false }
      ]);
      const results = await repo.findAllSessions();
      expect(results.length).toBe(2);
      expect(results[0]?.id).toBe('s1');
      expect(mockSelect).toHaveBeenCalled();
    });
  });

  describe('deleteSessions', () => {
    it('should delete multiple sessions at once', async () => {
      await repo.deleteSessions(['s1', 's2']);
      // deleteSessions uses a transaction with tx.delete inside
      expect((db as any).transaction).toHaveBeenCalled();
    });
  });

  describe('togglePin', () => {
    it('should toggle pin state correctly', async () => {
      await repo.togglePin('sp', true);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ isPinned: true }));
    });
  });

  describe('updateSessionTitle', () => {
    it('should update the title of an existing session', async () => {
      await repo.updateSessionTitle('s1', 'New Title');
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Title' }));
      expect(mockWhere).toHaveBeenCalled();
    });
  });

  describe('deleteMessage', () => {
    it('should delete a specific message and its parts', async () => {
      await repo.deleteMessage('s1', 'm1');
      // transaction calls db.delete 2 times
      expect((db as any).transaction).toHaveBeenCalled();
    });
  });

  describe('deleteMessageAndFollowing', () => {
    it('should delete specified message and all subsequent messages in the session', async () => {
      await repo.deleteMessageAndFollowing('s1', 'm2');
      // transaction triggers db logic
      expect((db as any).transaction).toHaveBeenCalled();
    });
  });
});
