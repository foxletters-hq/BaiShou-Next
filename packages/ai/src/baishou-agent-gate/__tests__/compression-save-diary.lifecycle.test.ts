import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  AgentGateCancelledError,
  AgentGateCorrectedError,
  AgentGateKind,
  AgentGateRejectedError,
  AGENT_GATE_LIFECYCLE_COMPRESSION_SAVE_DIARY
} from '@baishou/shared'
import {
  buildSessionChatDiaryDraft,
  runCompressionSaveDiaryLifecycle
} from '../compression-save-diary.lifecycle'
import type { MessageWithParts } from '../../agent/message.adapter'
import type { IBaishouAgentGate } from '../baishou-agent-gate.service'
import type { ToolDiarySearcher } from '../../tools/agent.tool'

const sampleMessages: MessageWithParts[] = [
  {
    id: 'm1',
    sessionId: 'sess_1',
    role: 'user',
    isSummary: false,
    orderIndex: 0,
    createdAt: new Date(),
    parts: [
      { id: 'p1', messageId: 'm1', sessionId: 'sess_1', type: 'text', data: { text: '你好' } }
    ]
  },
  {
    id: 'm2',
    sessionId: 'sess_1',
    role: 'assistant',
    isSummary: false,
    orderIndex: 1,
    createdAt: new Date(),
    parts: [
      { id: 'p2', messageId: 'm2', sessionId: 'sess_1', type: 'text', data: { text: '你好呀' } }
    ]
  }
]

describe('buildSessionChatDiaryDraft', () => {
  it('formats user and assistant messages as markdown', () => {
    const draft = buildSessionChatDiaryDraft(sampleMessages)
    expect(draft).toContain('## 对话归档（压缩前保存）')
    expect(draft).toContain('### 用户')
    expect(draft).toContain('你好')
    expect(draft).toContain('### 助手')
    expect(draft).toContain('你好呀')
  })
})

describe('runCompressionSaveDiaryLifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-22T10:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('skips when agentGate is absent', async () => {
    const result = await runCompressionSaveDiaryLifecycle({
      sessionId: 'sess_1',
      vaultName: 'Personal',
      messages: sampleMessages
    })
    expect(result).toEqual({ saved: false, skipped: true })
  })

  it('writes a new diary entry after gate approval', async () => {
    const writeEntry = vi.fn().mockResolvedValue({ ok: true })
    const readByDates = vi.fn().mockResolvedValue([])
    const diarySearcher: ToolDiarySearcher = { searchFTS: vi.fn(), writeEntry, readByDates }
    const assert = vi.fn().mockResolvedValue(undefined)
    const agentGate = { assert } as unknown as IBaishouAgentGate

    const result = await runCompressionSaveDiaryLifecycle({
      agentGate,
      diarySearcher,
      sessionId: 'sess_1',
      vaultName: 'Personal',
      messages: sampleMessages
    })

    expect(assert).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess_1',
        vaultName: 'Personal',
        kind: AgentGateKind.Lifecycle,
        action: AGENT_GATE_LIFECYCLE_COMPRESSION_SAVE_DIARY,
        title: '压缩前保存对话到日记'
      })
    )
    expect(writeEntry).toHaveBeenCalledWith('2026-06-22', expect.stringContaining('你好'))
    expect(result).toEqual({ saved: true })
  })

  it('appends when today diary already exists', async () => {
    const editEntry = vi.fn().mockResolvedValue({ ok: true })
    const readByDates = vi.fn().mockResolvedValue([{ date: '2026-06-22', content: '已有内容' }])
    const diarySearcher: ToolDiarySearcher = {
      searchFTS: vi.fn(),
      readByDates,
      editEntry
    }
    const agentGate = { assert: vi.fn().mockResolvedValue(undefined) } as unknown as IBaishouAgentGate

    const result = await runCompressionSaveDiaryLifecycle({
      agentGate,
      diarySearcher,
      sessionId: 'sess_1',
      vaultName: 'Personal',
      messages: sampleMessages
    })

    expect(editEntry).toHaveBeenCalledWith({
      date: '2026-06-22',
      content: expect.stringContaining('你好'),
      mode: 'append'
    })
    expect(result).toEqual({ saved: true })
  })

  it('returns saved false on rejection without throwing', async () => {
    const agentGate = {
      assert: vi.fn().mockRejectedValue(new AgentGateRejectedError())
    } as unknown as IBaishouAgentGate

    const result = await runCompressionSaveDiaryLifecycle({
      agentGate,
      diarySearcher: { searchFTS: vi.fn(), writeEntry: vi.fn() },
      sessionId: 'sess_1',
      vaultName: 'Personal',
      messages: sampleMessages
    })

    expect(result).toEqual({ saved: false })
  })

  it('returns user message on corrected rejection', async () => {
    const agentGate = {
      assert: vi.fn().mockRejectedValue(new AgentGateCorrectedError('先别保存'))
    } as unknown as IBaishouAgentGate

    const result = await runCompressionSaveDiaryLifecycle({
      agentGate,
      diarySearcher: { searchFTS: vi.fn(), writeEntry: vi.fn() },
      sessionId: 'sess_1',
      vaultName: 'Personal',
      messages: sampleMessages
    })

    expect(result).toEqual({ saved: false, userMessage: '先别保存' })
  })

  it('rethrows cancellation to abort compression', async () => {
    const agentGate = {
      assert: vi.fn().mockRejectedValue(new AgentGateCancelledError())
    } as unknown as IBaishouAgentGate

    await expect(
      runCompressionSaveDiaryLifecycle({
        agentGate,
        diarySearcher: { searchFTS: vi.fn(), writeEntry: vi.fn() },
        sessionId: 'sess_1',
        vaultName: 'Personal',
        messages: sampleMessages
      })
    ).rejects.toBeInstanceOf(AgentGateCancelledError)
  })
})
