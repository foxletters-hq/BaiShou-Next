import type { AgentGatePreview, AgentGateRequest } from '@baishou/shared'

export function formatGateQueueLabel(index: number, total: number): string | null {
  if (total <= 1 || index <= 0) return null
  return `第 ${index} / 共 ${total} 项`
}

export function formatFileChangeKindLabel(kind: string): string {
  switch (kind) {
    case 'create':
      return '新建'
    case 'modify':
      return '修改'
    case 'delete':
      return '删除'
    case 'rename':
      return '重命名'
    default:
      return kind
  }
}

export function summarizePreviewForHistory(preview: AgentGatePreview | undefined): string | null {
  if (!preview) return null
  if (preview.type === 'file_change') {
    const kind = formatFileChangeKindLabel(preview.kind)
    const stats = `+${preview.additions} / -${preview.deletions}`
    if (preview.kind === 'rename' && preview.previousPath) {
      return `${kind} ${preview.previousPath} → ${preview.path}`
    }
    return `${kind} ${preview.path}（${stats}）`
  }
  if (preview.type === 'command') {
    const cmd = preview.command.length > 80 ? `${preview.command.slice(0, 79)}…` : preview.command
    return `命令 ${cmd}`
  }
  // content：优先 detailLines，避免与 title/subject 重复
  if (preview.detailLines && preview.detailLines.length > 0) {
    return preview.detailLines.slice(0, 3).join(' · ')
  }
  if (preview.summary && preview.summary !== preview.subject) {
    return preview.summary
  }
  return null
}

export function humanizeRepeatHint(request: AgentGateRequest): string | null {
  const count = request.repeatCount ?? 0
  if (count < 2) return null
  return `同一操作已连续请求 ${count} 次，需要你再次确认`
}

export function resolveScopeLabel(request: AgentGateRequest): string {
  if (request.scope?.kind === 'workspace') {
    return `工作区 ${request.scope.workspaceId}`
  }
  return request.vaultName ? `伙伴 ${request.vaultName}` : '当前伙伴'
}
