import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentGateKind, AgentGateRequestStatus, type AgentGateRequest } from '@baishou/shared'
import { useAgentGateInboxStore } from '@baishou/store'
import {
  disposeDesktopAgentGateInboxBridge,
  ensureDesktopAgentGateInboxBridge
} from '../agent-gate-inbox-bridge'

type AskedListener = (request: AgentGateRequest) => void
type CancelledListener = (payload: { sessionId: string; requestIds: string[] }) => void

const request: AgentGateRequest = {
  id: 'bag_mcp',
  sessionId: 'sess_1',
  vaultName: 'Personal',
  status: AgentGateRequestStatus.Pending,
  kind: AgentGateKind.Tool,
  action: 'mcp_client:baishou_memory_delete',
  title: 'MCP · 白守 · baishou_memory_delete',
  options: [],
  allowCustomInput: true,
  metadata: {},
  scope: { kind: 'companion' },
  createdAt: 1
}

let onAsked: AskedListener | null = null
let onCancelled: CancelledListener | null = null

beforeEach(() => {
  onAsked = null
  onCancelled = null
  useAgentGateInboxStore.getState().reset()
  ;(window as any).api = {
    agentGate: {
      listPending: vi.fn().mockResolvedValue([]),
      onAsked: (listener: AskedListener) => {
        onAsked = listener
        return () => undefined
      },
      onReplied: () => () => undefined,
      onCancelled: (listener: CancelledListener) => {
        onCancelled = listener
        return () => undefined
      }
    }
  }
})

afterEach(() => {
  disposeDesktopAgentGateInboxBridge()
  ;(window as any).api = undefined
})

describe('agent gate inbox bridge', () => {
  it('should ignore a late asked event after the request was cancelled', async () => {
    ensureDesktopAgentGateInboxBridge()
    await Promise.resolve()

    onAsked?.(request)
    expect(useAgentGateInboxStore.getState().pending.map((item) => item.id)).toEqual(['bag_mcp'])

    onCancelled?.({ sessionId: 'sess_1', requestIds: ['bag_mcp'] })
    expect(useAgentGateInboxStore.getState().pending).toEqual([])

    // 主进程里已取消的请求可能有迟到的 asked 事件，不能把确认卡复活
    onAsked?.(request)
    expect(useAgentGateInboxStore.getState().pending).toEqual([])
  })
})
