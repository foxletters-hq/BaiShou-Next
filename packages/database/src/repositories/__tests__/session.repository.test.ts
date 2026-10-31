import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionRepository } from '../session.repository'
import { AppDatabase } from '../../types'

describe('SessionRepository', () => {
  let db: unknown
  let repo: SessionRepository

  // Global Mock Builders
  let mockInsert: any
  let mockUpdate: any
  let mockDelete: any
  let mockValues: any
  let mockOnConflictDoUpdate: any
  let mockSet: any
  let mockWhere: any
  let mockSelect: any
  let mockFrom: any
  let mockOrderBy: any
  let mockOffset: any

  beforeEach(() => {
    vi.resetAllMocks()

    mockValues = vi.fn().mockReturnThis()
    mockOnConflictDoUpdate = vi.fn().mockResolvedValue([])

    mockInsert = vi.fn().mockReturnValue({
      values: mockValues,
      onConflictDoUpdate: mockOnConflictDoUpdate,
      onConflictDoNothing: vi.fn().mockResolvedValue([])
    })

    mockSet = vi.fn().mockReturnThis()
    mockWhere = vi.fn().mockResolvedValue([])
    mockUpdate = vi.fn().mockReturnValue({
      set: mockSet,
      where: mockWhere
    })

    mockDelete = vi.fn().mockReturnValue({
      where: mockWhere
    })

    mockOffset = vi.fn().mockResolvedValue([])
    mockOrderBy = vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({ offset: mockOffset })
    })
    const mockWhereLimit = vi.fn().mockResolvedValue([{ id: 'm2', orderIndex: 2, sessionId: 's1' }])

    // where() 返回值需要支持 await（直接 await 返回数组）和链式调用（.limit/.orderBy）
    const mockWhereResult = Object.assign(
      Promise.resolve([{ id: 'm2', orderIndex: 2, sessionId: 's1' }]),
      {
        limit: mockWhereLimit,
        orderBy: mockOrderBy
      }
    )

    const mockWhereChain = vi.fn().mockReturnValue(mockWhereResult)

    mockFrom = vi.fn().mockReturnValue({
      where: mockWhereChain,
      orderBy: mockOrderBy,
      innerJoin: vi.fn().mockReturnValue({
        where: mockWhereChain
      })
    })
    mockSelect = vi.fn().mockReturnValue({
      from: mockFrom
    })

    db = {
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      select: mockSelect,
      all: vi.fn().mockResolvedValue([]),
      transaction: vi.fn().mockImplementation(async (cb) => {
        // Transaction provides a 'tx' that behaves like 'db' — select/delete chains return arrays
        const txWhere = vi.fn().mockResolvedValue([])
        const txFrom = vi.fn().mockReturnValue({
          where: txWhere,
          orderBy: vi.fn().mockResolvedValue([])
        })
        const txSelect = vi.fn().mockReturnValue({ from: txFrom })
        const txDeleteWhere = vi.fn().mockResolvedValue(undefined)
        const txDelete = vi.fn().mockReturnValue({ where: txDeleteWhere })
        const tx = {
          select: txSelect,
          delete: txDelete,
          insert: mockInsert,
          update: mockUpdate,
          all: vi.fn().mockResolvedValue([])
        }
        return await cb(tx)
      })
    }

    repo = new SessionRepository(db as AppDatabase)
  })

  describe('findAllSessions', () => {
    it('fail-closed: missing vaultId returns empty', async () => {
      const results = await repo.findAllSessions()
      expect(results).toEqual([])
      expect(mockSelect).not.toHaveBeenCalled()
    })

    it('should return sessions scoped by vaultId', async () => {
      mockOffset.mockResolvedValueOnce([
        { id: 's1', isPinned: true },
        { id: 's2', isPinned: false }
      ])
      const results = await repo.findAllSessions(20, 0, undefined, undefined, 'vlt_test')
      expect(results.length).toBe(2)
      expect(results[0]?.id).toBe('s1')
      expect(mockSelect).toHaveBeenCalled()
    })

    it('should enrich sessions with latest message snippet and distinguish branched sessions on search', async () => {
      mockOffset.mockResolvedValueOnce([
        { id: 's_orig', title: '旅行计划', isPinned: false },
        { id: 's_branch', title: '旅行计划 (分支)', isPinned: false }
      ])
      // 1st db.all: FTS search in findSessionIdsMatchingMessageContent
      // 2nd db.all: latest messages in enrichSessionsWithSnippets
      // 3rd db.all: matched messages in enrichSessionsWithSnippets
      ;(db as any).all
        .mockResolvedValueOnce([{ sessionId: 's_orig' }, { sessionId: 's_branch' }])
        .mockResolvedValueOnce([
          {
            sessionId: 's_orig',
            messageId: 'm_orig_last',
            orderIndex: 5,
            text: '那我们最终决定去东京看展览'
          },
          {
            sessionId: 's_branch',
            messageId: 'm_branch_last',
            orderIndex: 5,
            text: '那我们最终决定去北海道滑雪'
          }
        ])
        .mockResolvedValueOnce([
          {
            sessionId: 's_orig',
            messageId: 'm_shared_1',
            orderIndex: 2,
            text: '年假有五天时间可以安排'
          },
          {
            sessionId: 's_branch',
            messageId: 'm_shared_copy_1',
            orderIndex: 2,
            text: '年假有五天时间可以安排'
          }
        ])

      const results = await repo.findAllSessions(20, 0, undefined, '年假', 'vlt_test')
      expect(results).toHaveLength(2)
      expect((results[0] as any)?.snippet).toContain('年假有五天')
      expect((results[0] as any)?.snippet).toContain('最新: 那我们最终决定去东京看展览')
      expect((results[1] as any)?.snippet).toContain('年假有五天')
      expect((results[1] as any)?.snippet).toContain('最新: 那我们最终决定去北海道滑雪')
      expect((results[0] as any)?.snippet).not.toBe((results[1] as any)?.snippet)
    })
  })

  describe('deleteSessions', () => {
    it('should delete multiple sessions at once', async () => {
      await repo.deleteSessions(['s1', 's2'])
      // deleteSessions uses a transaction with tx.delete inside
      expect((db as any).transaction).toHaveBeenCalled()
    })
  })

  describe('togglePin', () => {
    it('should toggle pin state correctly', async () => {
      await repo.togglePin('sp', true)
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ isPinned: true }))
    })
  })

  describe('updateSessionTitle', () => {
    it('should update the title of an existing session', async () => {
      await repo.updateSessionTitle('s1', 'New Title')
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Title' }))
      expect(mockWhere).toHaveBeenCalled()
    })
  })

  describe('updateSessionDialogueModel', () => {
    it('should update provider and model of an existing session', async () => {
      await repo.updateSessionDialogueModel('s1', 'openai', 'gpt-4o')
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: 'openai', modelId: 'gpt-4o' })
      )
      expect(mockWhere).toHaveBeenCalled()
    })
  })

  describe('replaceMessageParts', () => {
    it('should delete existing parts then insert the new snapshot', async () => {
      await repo.replaceMessageParts('m1', 's1', [
        { id: 'p2', messageId: 'm1', sessionId: 's1', type: 'text', data: { text: '半成品' } }
      ])
      expect((db as any).transaction).toHaveBeenCalled()
      expect(mockInsert).toHaveBeenCalledTimes(1)
    })

    it('should ensure parent message row exists via onConflictDoNothing when orderIndex is provided in billing', async () => {
      await repo.replaceMessageParts(
        'm1',
        's1',
        [{ id: 'p2', messageId: 'm1', sessionId: 's1', type: 'text', data: { text: '最终回复' } }],
        {
          role: 'assistant',
          orderIndex: 2,
          inputTokens: 10,
          outputTokens: 20,
          providerId: 'openai',
          modelId: 'gpt-4o'
        }
      )
      expect((db as any).transaction).toHaveBeenCalled()
      // 1st insert: ensure parent message row; 2nd insert: replacement parts
      expect(mockInsert).toHaveBeenCalledTimes(2)
      expect(mockValues).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          id: 'm1',
          sessionId: 's1',
          role: 'assistant',
          orderIndex: 2
        })
      )
    })
  })

  describe('deleteMessage', () => {
    it('should delete a specific message and its parts', async () => {
      await repo.deleteMessage('s1', 'm1')
      // transaction calls db.delete 2 times
      expect((db as any).transaction).toHaveBeenCalled()
    })
  })

  describe('deleteMessageAndFollowing', () => {
    it('should delete specified message and all subsequent messages in the session', async () => {
      await repo.deleteMessageAndFollowing('s1', 'm2')
      // transaction triggers db logic
      expect((db as any).transaction).toHaveBeenCalled()
    })
  })

  describe('insertMessageWithParts and getMessagesBySession order invariant', () => {
    it('shifts existing messages at or after target orderIndex before inserting', async () => {
      await repo.insertMessageWithParts(
        {
          id: 'a1',
          sessionId: 's1',
          role: 'assistant',
          orderIndex: 2
        },
        [{ id: 'p1', messageId: 'a1', sessionId: 's1', type: 'text', data: { text: '回复1' } }]
      )

      expect((db as any).transaction).toHaveBeenCalled()
      // 1st update: shift orderIndex >= 2; 2nd update: session updatedAt
      expect(mockUpdate).toHaveBeenCalledTimes(2)
      expect(mockInsert).toHaveBeenCalledTimes(2)
    })

    it('orders assistant message before user message when legacy rows share the same orderIndex', async () => {
      // getMessagesBySession queries DESC by orderIndex; simulate [a1(2), u2(2), u1(1)] returned by DESC
      mockOffset.mockResolvedValueOnce([
        { id: 'a1', sessionId: 's1', role: 'assistant', orderIndex: 2 },
        { id: 'u2', sessionId: 's1', role: 'user', orderIndex: 2 },
        { id: 'u1', sessionId: 's1', role: 'user', orderIndex: 1 }
      ])

      const messages = await repo.getMessagesBySession('s1', 50, 0)
      expect(messages.map((m: any) => m.id)).toEqual(['u1', 'a1', 'u2'])
    })
  })
})
