import { emitAgentSessionRuntime } from '../../agent/session-runtime-event'
import { getContextEpochStore } from './store'
import type {
  ContextEpochPrepareInput,
  ContextEpochPrepareResult,
  ContextEpochSourceSnapshot,
  ContextEpochState,
  ContextEpochStore
} from './types'

const SOURCE_ORDER = [
  'runtime/time',
  'runtime/vault',
  'workspace/env',
  'skills/catalog'
] as const

export function fingerprint(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    hash = (hash * 31 + content.charCodeAt(i)) | 0
  }
  return `${content.length}:${hash}`
}

function stripVolatileSections(full: string): string {
  // 从完整 system 中裁掉易变分区，留下 baseline（人设/协议/能力/工具规范等）
  return full
    .replace(/<runtime_context>[\s\S]*?<\/runtime_context>\s*/g, '')
    .replace(/<workspace_env>[\s\S]*?<\/workspace_env>\s*/g, '')
    .replace(/<skills_catalog>[\s\S]*?<\/skills_catalog>\s*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function buildSourceSnapshots(
  sourceContents: ContextEpochPrepareInput['sourceContents']
): Record<string, ContextEpochSourceSnapshot> {
  const out: Record<string, ContextEpochSourceSnapshot> = {}
  for (const id of SOURCE_ORDER) {
    const content = sourceContents[id]?.trim()
    if (!content) continue
    out[id] = { id, content, fingerprint: fingerprint(content) }
  }
  return out
}

function sourcesFingerprintsMatch(
  prev: Record<string, ContextEpochSourceSnapshot> | undefined,
  next: Record<string, ContextEpochSourceSnapshot>
): boolean {
  for (const id of SOURCE_ORDER) {
    const p = prev?.[id]?.fingerprint
    const n = next[id]?.fingerprint
    if (p !== n) return false
  }
  // next 未覆盖的 prev key：SOURCE_ORDER 已穷尽易变源
  return true
}

/**
 * 重组 system：baseline + 易变分区。
 *
 * SystemPromptBuilder 顺序为 persona → protocol → runtime_context → workspace_env →
 * skills_catalog → context_encoding → …；stripVolatile 后的 baseline 已含 persona/protocol/
 * encoding 等稳定段，易变段被裁掉。此处只能在 baseline 末尾按 SOURCE_ORDER 追加
 * runtime_context → workspace_env → skills_catalog，无法插回 encoding 之前，属有意折中。
 */
function composeSystem(
  baseline: string,
  sources: Record<string, ContextEpochSourceSnapshot>
): string {
  const parts: string[] = []
  if (baseline.trim()) parts.push(baseline.trim())
  for (const id of SOURCE_ORDER) {
    const snap = sources[id]
    if (!snap?.content) continue
    // runtime/time 与 runtime/vault 合并进同一 runtime_context 块
    if (id === 'runtime/time') {
      const vault = sources['runtime/vault']?.content
      const lines = [snap.content, vault].filter(Boolean).join('\n')
      parts.push(`<runtime_context>\n${lines}\n</runtime_context>`)
      continue
    }
    if (id === 'runtime/vault') continue
    const tag =
      id === 'workspace/env'
        ? 'workspace_env'
        : id === 'skills/catalog'
          ? 'skills_catalog'
          : 'system_update'
    parts.push(`<${tag}>\n${snap.content}\n</${tag}>`)
  }
  return parts.join('\n\n')
}

function diffUpdates(
  prev: Record<string, ContextEpochSourceSnapshot> | undefined,
  next: Record<string, ContextEpochSourceSnapshot>
): Array<{ sourceId: string; content: string }> {
  const updates: Array<{ sourceId: string; content: string }> = []
  for (const id of SOURCE_ORDER) {
    const n = next[id]
    if (!n) continue
    const p = prev?.[id]
    if (!p || p.fingerprint !== n.fingerprint) {
      updates.push({ sourceId: id, content: n.content })
    }
  }
  return updates
}

function toResult(
  state: ContextEpochState,
  updates: ContextEpochPrepareResult['updates'],
  isNewEpoch: boolean
): ContextEpochPrepareResult {
  return {
    systemPrompt: state.composedSystemPrompt ?? state.baseline,
    baseline: state.baseline,
    updates,
    baselineSeq: state.baselineSeq,
    isNewEpoch
  }
}

/**
 * Context Epoch：baseline 稳定 + turn 边界 reconcile 易变 sources。
 * 压缩成功后调用 replace() 换新 baseline。
 */
export class ContextEpoch {
  constructor(private readonly store: ContextEpochStore = getContextEpochStore()) {}

  /**
   * 同一次 stream 内 fullSystemPrompt 未变时跳过 regex/compose，直接返回缓存。
   * 调用方（prepareSystemPromptWithEpoch）可据此避免抽取 tagged sections。
   */
  peekUnchangedPrepare(sessionId: string, fullSystemPrompt: string): ContextEpochPrepareResult | null {
    const existing = this.store.load(sessionId)
    if (!existing?.composedSystemPrompt || !existing.fullSystemPromptFingerprint) return null
    if (existing.fullSystemPromptFingerprint !== fingerprint(fullSystemPrompt)) return null
    return toResult(existing, [], false)
  }

  prepare(input: ContextEpochPrepareInput): ContextEpochPrepareResult {
    const fullFp = fingerprint(input.fullSystemPrompt)
    const existing = this.store.load(input.sessionId)

    // 全量 prompt 指纹未变且已有 composed：零成本复用（sources 必然一致）
    if (
      existing?.composedSystemPrompt &&
      existing.fullSystemPromptFingerprint === fullFp
    ) {
      return toResult(existing, [], false)
    }

    const nextSources = buildSourceSnapshots(input.sourceContents)

    // updates 为空且已有 composed：复用，跳过 stripVolatile + composeSystem
    if (
      existing?.composedSystemPrompt &&
      existing.baseline?.trim() &&
      sourcesFingerprintsMatch(existing.sources, nextSources)
    ) {
      const state: ContextEpochState = {
        ...existing,
        sources: nextSources,
        fullSystemPromptFingerprint: fullFp,
        updatedAt: Date.now()
      }
      this.store.save(state)
      return toResult(state, [], false)
    }

    const nextBaseline = existing?.baseline?.trim()
      ? existing.baseline
      : stripVolatileSections(input.fullSystemPrompt)

    const isNewEpoch = !existing
    const updates = isNewEpoch ? [] : diffUpdates(existing?.sources, nextSources)
    const baselineSeq = existing?.baselineSeq ?? 0

    // 非新 epoch、无增量、已有 composed：再兜一层（与 sources 指纹路径互补）
    if (!isNewEpoch && updates.length === 0 && existing?.composedSystemPrompt) {
      const state: ContextEpochState = {
        ...existing,
        sources: nextSources,
        fullSystemPromptFingerprint: fullFp,
        updatedAt: Date.now()
      }
      this.store.save(state)
      return toResult(state, [], false)
    }

    const systemPrompt = isNewEpoch
      ? input.fullSystemPrompt
      : composeSystem(nextBaseline, nextSources)

    const state: ContextEpochState = {
      sessionId: input.sessionId,
      baselineSeq,
      baseline: nextBaseline,
      sources: nextSources,
      updatedAt: Date.now(),
      composedSystemPrompt: systemPrompt,
      fullSystemPromptFingerprint: fullFp
    }
    this.store.save(state)

    return {
      systemPrompt,
      baseline: nextBaseline,
      updates,
      baselineSeq,
      isNewEpoch
    }
  }

  /** 压缩后替换 baseline，并清空 mid-system sources（下一轮重新 reconcile） */
  replace(sessionId: string, newBaseline: string): ContextEpochState {
    const existing = this.store.load(sessionId)
    const baselineSeq = (existing?.baselineSeq ?? 0) + 1
    const state: ContextEpochState = {
      sessionId,
      baselineSeq,
      baseline: newBaseline.trim(),
      sources: {},
      updatedAt: Date.now()
      // composed / fullFp 故意不保留：强制下次 prepare 重建
    }
    this.store.save(state)
    emitAgentSessionRuntime({
      type: 'session.epoch_replaced',
      sessionId,
      baselineSeq,
      timestamp: state.updatedAt
    })
    return state
  }

  get(sessionId: string): ContextEpochState | null {
    return this.store.load(sessionId)
  }

  clear(sessionId: string): void {
    this.store.delete(sessionId)
  }
}

let sharedEpoch: ContextEpoch | null = null

export function getSharedContextEpoch(): ContextEpoch {
  if (!sharedEpoch) sharedEpoch = new ContextEpoch()
  return sharedEpoch
}

export function resetSharedContextEpochForTests(): void {
  sharedEpoch = null
}
