import type { WorkspaceEnvInfo } from '../../agent/workspace-env.util'

export interface ContextEpochSourceSnapshot {
  id: string
  /** 稳定指纹，用于 diff */
  fingerprint: string
  /** 写入 chronological system update 的文本块（不含外层 tag 也可） */
  content: string
}

export interface ContextEpochState {
  sessionId: string
  baselineSeq: number
  /** 稳定 system 前缀（人设 / 协议 / 工具规范等） */
  baseline: string
  /** 当前各 source 快照 */
  sources: Record<string, ContextEpochSourceSnapshot>
  updatedAt: number
  /** 最近一次 compose / 首轮 full 的 system，供同 stream 内复用 */
  composedSystemPrompt?: string
  /** fullSystemPrompt 指纹：未变时可跳过 regex 抽取与 compose */
  fullSystemPromptFingerprint?: string
}

export interface ContextEpochPrepareInput {
  sessionId: string
  /** 完整 builder 结果；首次或 replace 时拆 baseline */
  fullSystemPrompt: string
  /** 易变段 content 映射 */
  sourceContents: {
    'runtime/time'?: string
    'runtime/vault'?: string
    'workspace/env'?: string
    'skills/catalog'?: string
  }
  workspaceEnv?: WorkspaceEnvInfo
}

export interface ContextEpochPrepareResult {
  /** 发给模型的 system：baseline + 未入 baseline 的 updates 拼合（兼容单 system 字段） */
  systemPrompt: string
  baseline: string
  /** 本轮相对上一轮的增量补丁（可观测 / 未来拆 multi-system） */
  updates: Array<{ sourceId: string; content: string }>
  baselineSeq: number
  isNewEpoch: boolean
}

export interface ContextEpochStore {
  load(sessionId: string): ContextEpochState | null
  save(state: ContextEpochState): void
  delete(sessionId: string): void
}
