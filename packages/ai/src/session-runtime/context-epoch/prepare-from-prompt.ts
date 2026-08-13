import { getSharedContextEpoch } from './context-epoch'
import type { ContextEpochPrepareResult } from './types'

function extractTaggedSection(prompt: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*</${tag}>`, 'i')
  const m = prompt.match(re)
  const body = m?.[1]?.trim()
  return body || undefined
}

/** 从完整 system prompt 抽取 Epoch sources，并 prepare */
export function prepareSystemPromptWithEpoch(params: {
  sessionId: string
  fullSystemPrompt: string
}): ContextEpochPrepareResult {
  const full = params.fullSystemPrompt
  const epoch = getSharedContextEpoch()
  // 同 stream 内 full 未变：跳过 regex 抽取 + compose
  const cached = epoch.peekUnchangedPrepare(params.sessionId, full)
  if (cached) return cached

  return epoch.prepare({
    sessionId: params.sessionId,
    fullSystemPrompt: full,
    sourceContents: {
      'runtime/time': extractTaggedSection(full, 'runtime_context'),
      'workspace/env': extractTaggedSection(full, 'workspace_env'),
      'skills/catalog': extractTaggedSection(full, 'skills_catalog')
    }
  })
}

/** 压缩后替换 epoch baseline（sources 清空、baselineSeq+1、发 session.epoch_replaced） */
export function replaceEpochBaselineAfterCompression(
  sessionId: string,
  newBaselinePrompt: string
): void {
  getSharedContextEpoch().replace(sessionId, newBaselinePrompt)
}
