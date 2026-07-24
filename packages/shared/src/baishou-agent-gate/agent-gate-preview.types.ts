import type { FileChangeKind } from '../agent-workspace/file-change.types'

/** 文件类预执行预览（工作区写/改/删/重命名） */
export interface AgentGateFileChangePreview {
  type: 'file_change'
  path: string
  kind: FileChangeKind
  additions: number
  deletions: number
  /** Unified diff；可能因体积截断 */
  diff?: string
  previousPath?: string
  truncated?: boolean
  /** 供指纹使用的内容摘要（非完整正文） */
  contentDigest?: string
}

/** Shell 命令预览 */
export interface AgentGateCommandPreview {
  type: 'command'
  command: string
  workdir?: string
  externalPaths?: string[]
  dangerous?: boolean
  dangerReason?: string
  prefixPattern?: string
}

/** 日记 / 记忆 / 图谱等内容类预览 */
export interface AgentGateContentPreview {
  type: 'content'
  subject: string
  summary?: string
  detailLines?: string[]
  counts?: Record<string, number>
}

export type AgentGatePreview =
  | AgentGateFileChangePreview
  | AgentGateCommandPreview
  | AgentGateContentPreview

/** 从 preview 提取指纹摘要片段 */
export function agentGatePreviewFingerprintPart(preview: AgentGatePreview | undefined): string {
  if (!preview) return ''
  if (preview.type === 'file_change') {
    return [
      preview.kind,
      preview.path,
      preview.previousPath ?? '',
      preview.contentDigest ?? '',
      String(preview.additions),
      String(preview.deletions)
    ].join('|')
  }
  if (preview.type === 'command') {
    return [preview.command, preview.workdir ?? '', preview.prefixPattern ?? ''].join('|')
  }
  return [preview.subject, preview.summary ?? '', JSON.stringify(preview.counts ?? {})].join('|')
}

export function isAgentGateFileChangePreview(
  preview: AgentGatePreview | undefined
): preview is AgentGateFileChangePreview {
  return preview?.type === 'file_change'
}

export function isAgentGateCommandPreview(
  preview: AgentGatePreview | undefined
): preview is AgentGateCommandPreview {
  return preview?.type === 'command'
}

export function isAgentGateContentPreview(
  preview: AgentGatePreview | undefined
): preview is AgentGateContentPreview {
  return preview?.type === 'content'
}

/** 预览过大或不完整时禁用 Always（避免盲授权） */
export function shouldDisableAlwaysForPreview(preview: AgentGatePreview | undefined): boolean {
  if (!preview) return false
  if (preview.type === 'file_change' && preview.truncated) return true
  if (preview.type === 'command' && preview.dangerous) return true
  return false
}
