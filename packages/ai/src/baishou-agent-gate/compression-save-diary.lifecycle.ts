import {
  AGENT_GATE_LIFECYCLE_COMPRESSION_SAVE_DIARY,
  AgentGateCancelledError,
  AgentGateCorrectedError,
  AgentGateKind,
  AgentGateRejectedError
} from '@baishou/shared'
import type { MessageWithParts } from '../agent/message.adapter'
import { extractMessageText } from '../agent/context-compression.utils'
import type { ToolDiarySearcher } from '../tools/agent.tool'
import type { IBaishouAgentGate } from './baishou-agent-gate.service'

export { AGENT_GATE_LIFECYCLE_COMPRESSION_SAVE_DIARY }

export interface CompressionSaveDiaryLifecycleOptions {
  agentGate?: IBaishouAgentGate
  diarySearcher?: ToolDiarySearcher
  sessionId: string
  vaultName: string
  messages: MessageWithParts[]
}

export interface CompressionSaveDiaryLifecycleResult {
  saved: boolean
  skipped?: boolean
  userMessage?: string
}

function formatLocalDate(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function buildSessionChatDiaryDraft(messages: MessageWithParts[]): string {
  const lines: string[] = ['## 对话归档（压缩前保存）', '']

  for (const msg of messages) {
    if (msg.role !== 'user' && msg.role !== 'assistant') continue
    const text = extractMessageText(msg).trim()
    if (!text) continue
    const label = msg.role === 'user' ? '用户' : '助手'
    lines.push(`### ${label}`, '', text, '')
  }

  return lines.join('\n').trimEnd()
}

async function persistDiaryDraft(
  diarySearcher: ToolDiarySearcher,
  content: string
): Promise<boolean> {
  const today = formatLocalDate()
  const draft = content.trim()
  if (!draft) return false

  if (diarySearcher.readByDates) {
    const rows = await diarySearcher.readByDates([today])
    const existing = rows.find((row) => row.date === today)?.content
    if (existing && diarySearcher.editEntry) {
      const result = await diarySearcher.editEntry({
        date: today,
        content: draft,
        mode: 'append'
      })
      return result.ok === true
    }
  }

  if (diarySearcher.writeEntry) {
    const result = await diarySearcher.writeEntry(today, draft)
    return result.ok === true
  }

  return false
}

export async function runCompressionSaveDiaryLifecycle(
  options: CompressionSaveDiaryLifecycleOptions
): Promise<CompressionSaveDiaryLifecycleResult> {
  const { agentGate, diarySearcher, sessionId, vaultName, messages } = options

  if (!agentGate) {
    return { saved: false, skipped: true }
  }

  try {
    await agentGate.assert({
      sessionId,
      vaultName,
      kind: AgentGateKind.Lifecycle,
      action: AGENT_GATE_LIFECYCLE_COMPRESSION_SAVE_DIARY,
      title: '压缩前保存对话到日记',
      description: '上下文即将压缩，是否将当前对话内容追加保存到今日日记？'
    })
  } catch (error) {
    if (error instanceof AgentGateCancelledError) {
      throw error
    }
    if (error instanceof AgentGateCorrectedError) {
      return { saved: false, userMessage: error.feedback }
    }
    if (error instanceof AgentGateRejectedError) {
      return { saved: false }
    }
    throw error
  }

  if (!diarySearcher) {
    return { saved: false }
  }

  const draft = buildSessionChatDiaryDraft(messages)
  if (!draft) {
    return { saved: false }
  }

  const saved = await persistDiaryDraft(diarySearcher, draft)
  return { saved }
}
