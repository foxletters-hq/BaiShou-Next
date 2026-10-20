import { describe, expect, it, vi } from 'vitest'
import {
  AgentGateCancelledError,
  AgentGateKind,
  AgentGateRejectedError,
  AgentGateReply,
  listAgentGateFileChangePreviews
} from '@baishou/shared'
import { createBaishouAgentGate } from '../baishou-agent-gate.service'
import { baseAssertInput } from './baishou-agent-gate.test-helpers'

describe('BaishouAgentGateService', () => {
  it('reject 级联取消同 session 其他挂起请求', async () => {
    const { gate } = createBaishouAgentGate()

    const first = gate.assert(baseAssertInput).catch((e) => e)
    const second = gate
      .assert({ ...baseAssertInput, action: 'diary_write', title: '写日记' })
      .catch((e) => e)

    const pending = gate.listPending('sess_1')
    expect(pending).toHaveLength(2)

    await gate.reply({
      requestId: pending[0]!.id,
      reply: AgentGateReply.Reject
    })

    const firstError = await first
    const secondError = await second
    expect(firstError).toBeInstanceOf(AgentGateRejectedError)
    expect(secondError).toBeInstanceOf(AgentGateRejectedError)
    expect(gate.listPending('sess_1')).toHaveLength(0)
  })

  it('always 级联放行同 session 同 action 的挂起请求', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })

    const first = gate.assert(baseAssertInput)
    const second = gate.assert({ ...baseAssertInput, title: '编辑日记 2' })
    const other = gate.assert({
      ...baseAssertInput,
      action: 'diary_write',
      title: '写日记'
    })

    const pending = gate.listPending('sess_1')
    expect(pending).toHaveLength(2)
    expect(pending.filter((r) => r.action === 'diary_edit')).toHaveLength(1)
    expect(pending.find((r) => r.action === 'diary_edit')?.coalescedCount).toBe(2)

    const diaryEditIds = pending.filter((r) => r.action === 'diary_edit').map((r) => r.id)
    await gate.reply({ requestId: diaryEditIds[0]!, reply: AgentGateReply.Always })

    await first
    await second
    expect(gate.listPending('sess_1')).toHaveLength(1)
    expect(gate.listPending('sess_1')[0]?.action).toBe('diary_write')

    await gate.reply({
      requestId: gate.listPending('sess_1')[0]!.id,
      reply: AgentGateReply.Once
    })
    await other
  })

  it('once 级联放行同 session 同 action 的挂起请求，且不写入 allowlist', async () => {
    const persist = vi.fn().mockResolvedValue(undefined)
    const { gate, allowlistStore } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      },
      persistConfig: persist
    })

    const first = gate.assert({ ...baseAssertInput, action: 'url_read', title: '读取网页 1' })
    const second = gate.assert({ ...baseAssertInput, action: 'url_read', title: '读取网页 2' })
    const other = gate.assert({
      ...baseAssertInput,
      action: 'workspace_write',
      title: '写入文件'
    })

    const pending = gate.listPending('sess_1')
    expect(pending.filter((request) => request.action === 'url_read')).toHaveLength(1)
    expect(pending.find((request) => request.action === 'url_read')?.coalescedCount).toBe(2)
    const urlIds = pending
      .filter((request) => request.action === 'url_read')
      .map((request) => request.id)
    await gate.reply({ requestId: urlIds[0]!, reply: AgentGateReply.Once })

    await first
    await second
    expect(gate.listPending('sess_1')).toHaveLength(1)
    expect(gate.listPending('sess_1')[0]?.action).toBe('workspace_write')
    expect(allowlistStore.list()).toHaveLength(0)
    expect(persist).not.toHaveBeenCalled()

    await gate.reply({
      requestId: gate.listPending('sess_1')[0]!.id,
      reply: AgentGateReply.Once
    })
    await other
  })

  it('同类工具并行请求只出一张确认卡', async () => {
    const { gate, eventBus } = createBaishouAgentGate()
    const askedIds: string[] = []
    const unsub = eventBus.subscribe((event) => {
      if (event.type === 'agent_gate.asked') askedIds.push(event.request.id)
    })

    const first = gate.assert({
      ...baseAssertInput,
      action: 'recall_relations',
      title: '回忆关系图谱 1'
    })
    const second = gate.assert({
      ...baseAssertInput,
      action: 'recall_relations',
      title: '回忆关系图谱 2'
    })
    const third = gate.assert({
      ...baseAssertInput,
      action: 'recall_relations',
      title: '回忆关系图谱 3'
    })

    const pending = gate.listPending('sess_1')
    expect(pending).toHaveLength(1)
    expect(pending[0]?.action).toBe('recall_relations')
    expect(pending[0]?.coalescedCount).toBe(3)
    expect(new Set(askedIds).size).toBe(1)

    await gate.reply({ requestId: pending[0]!.id, reply: AgentGateReply.Once })
    await Promise.all([first, second, third])
    expect(gate.listPending('sess_1')).toHaveLength(0)
    unsub()
  })

  it('should keep every coalesced write preview on the pending card', async () => {
    const { gate } = createBaishouAgentGate()
    const first = gate.assert({
      ...baseAssertInput,
      action: 'workspace_write',
      title: '写入 a.md',
      preview: {
        type: 'file_change',
        path: 'a.md',
        kind: 'create',
        additions: 1,
        deletions: 0,
        diff: '+a'
      }
    })
    const second = gate.assert({
      ...baseAssertInput,
      action: 'workspace_write',
      title: '写入 b.md',
      preview: {
        type: 'file_change',
        path: 'b.md',
        kind: 'create',
        additions: 2,
        deletions: 0,
        diff: '+b'
      }
    })

    const pending = gate.listPending('sess_1')
    expect(pending).toHaveLength(1)
    expect(pending[0]?.coalescedCount).toBe(2)
    expect(listAgentGateFileChangePreviews(pending[0]!).map((item) => item.path)).toEqual([
      'a.md',
      'b.md'
    ])

    await gate.reply({ requestId: pending[0]!.id, reply: AgentGateReply.Once })
    await Promise.all([first, second])
  })

  it('should keep write and patch on one pending card', async () => {
    const { gate } = createBaishouAgentGate()
    const first = gate.assert({
      ...baseAssertInput,
      action: 'workspace_write',
      title: '写入 a.md',
      preview: {
        type: 'file_change',
        path: 'a.md',
        kind: 'create',
        additions: 1,
        deletions: 0,
        diff: '+a'
      }
    })
    const second = gate.assert({
      ...baseAssertInput,
      action: 'workspace_patch',
      title: '补丁 b.md',
      preview: {
        type: 'file_change',
        path: 'b.md',
        kind: 'modify',
        additions: 2,
        deletions: 1,
        diff: '+b'
      }
    })

    const pending = gate.listPending('sess_1')
    expect(pending).toHaveLength(1)
    expect(pending[0]?.coalescedCount).toBe(2)
    expect(listAgentGateFileChangePreviews(pending[0]!).map((item) => item.path)).toEqual([
      'a.md',
      'b.md'
    ])

    await gate.reply({ requestId: pending[0]!.id, reply: AgentGateReply.Once })
    await Promise.all([first, second])
  })

  it('伙伴提问不合并，即使连续发起多次', async () => {
    const { gate } = createBaishouAgentGate()
    const first = gate
      .assert({
        ...baseAssertInput,
        kind: AgentGateKind.Proactive,
        action: 'companion_ask',
        title: '要查图谱吗？',
        options: [{ id: '0', label: '要' }]
      })
      .catch((error) => error)
    const second = gate
      .assert({
        ...baseAssertInput,
        kind: AgentGateKind.Proactive,
        action: 'companion_ask',
        title: '要从图谱里查张三吗？',
        options: [{ id: '0', label: '要' }]
      })
      .catch((error) => error)

    expect(gate.listPending('sess_1')).toHaveLength(2)
    gate.cancelSession('sess_1')
    expect(await first).toBeInstanceOf(AgentGateCancelledError)
    expect(await second).toBeInstanceOf(AgentGateCancelledError)
  })

  it('once 后本轮同类操作不再询问，回答结束后恢复询问', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })

    const first = gate.assert({ ...baseAssertInput, action: 'url_read', title: '读取网页' })
    await Promise.resolve()
    await gate.reply({
      requestId: gate.listPending('sess_1')[0]!.id,
      reply: AgentGateReply.Once
    })
    await first

    await expect(
      gate.assert({ ...baseAssertInput, action: 'url_read', title: '再读一页' })
    ).resolves.toBeUndefined()
    expect(gate.listPending('sess_1')).toHaveLength(0)

    const otherPending = gate.assert({
      ...baseAssertInput,
      action: 'workspace_write',
      title: '写入文件'
    })
    await Promise.resolve()
    expect(gate.listPending('sess_1')).toHaveLength(1)
    await gate.reply({
      requestId: gate.listPending('sess_1')[0]!.id,
      reply: AgentGateReply.Once
    })
    await otherPending

    gate.cancelSession('sess_1', 'stream ended')

    const afterTurn = gate.assert({ ...baseAssertInput, action: 'url_read', title: '下一轮读取' })
    await Promise.resolve()
    expect(gate.listPending('sess_1')).toHaveLength(1)
    await gate.reply({
      requestId: gate.listPending('sess_1')[0]!.id,
      reply: AgentGateReply.Once
    })
    await afterTurn
  })
})
