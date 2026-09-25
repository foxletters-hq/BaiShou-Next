import { AgentGateKind } from './agent-gate.enums'
import { isWorkspaceEditGateAction } from './agent-gate-capability.util'
import {
  mergeAgentGatePreviews,
  shouldDisableAlwaysForPreview,
  type AgentGatePreview
} from './agent-gate-preview.types'
import type { AgentGateRequest, AgentGateResourceRef } from './agent-gate.types'
import { extractAgentGateResourcesFromMetadata } from './agent-gate-policy.util'
import { resolveCommandPrefixPatternFromCommand } from './agent-gate-shell-match.util'

function firstAlwaysPattern(metadata?: Record<string, unknown>): string | null {
  if (!Array.isArray(metadata?.alwaysPatterns)) return null
  const found = metadata.alwaysPatterns.find(
    (item): item is string => typeof item === 'string' && item.trim().length > 0
  )
  return found?.trim() ?? null
}

function resolveWorkspaceRunPattern(input: {
  resources?: AgentGateResourceRef[]
  preview?: AgentGatePreview
  metadata?: Record<string, unknown>
}): string | null {
  const declared = firstAlwaysPattern(input.metadata)
  const shell = (input.resources ?? []).find((item) => item.kind === 'shell_command')
  const fromPreview =
    input.preview?.type === 'command' ? input.preview.prefixPattern || input.preview.command : null
  return (
    declared ||
    (shell ? resolveCommandPrefixPatternFromCommand(shell.value) : null) ||
    (typeof fromPreview === 'string' && fromPreview.trim()
      ? (resolveCommandPrefixPatternFromCommand(fromPreview) ?? fromPreview.trim())
      : null)
  )
}

/** 可并入同一张确认卡的同类工具调用；提问 / 不完整预览不合并。 */
export function resolveAgentGateToolCoalesceKey(input: {
  kind: AgentGateKind
  action: string
  resources?: AgentGateResourceRef[]
  preview?: AgentGatePreview
  metadata?: Record<string, unknown>
}): string | null {
  if (input.kind !== AgentGateKind.Tool) return null
  // 危险命令单独确认；截断文件改动仍并入同类编辑卡，Always 按钮由 shouldDisableAlwaysForRequest 关掉
  if (input.preview?.type === 'command' && shouldDisableAlwaysForPreview(input.preview)) {
    return null
  }

  if (input.action === 'workspace_run') {
    const pattern = resolveWorkspaceRunPattern(input)
    return pattern ? `workspace_run::${pattern}` : null
  }

  if (input.action === 'external_directory') {
    const declared = firstAlwaysPattern(input.metadata)
    const external = (input.resources ?? []).find((item) => item.kind === 'external_path')
    const pattern = declared || (external ? external.value.replace(/\\/g, '/') : null)
    return pattern ? `external_directory::${pattern}` : null
  }

  const external = (input.resources ?? []).find((item) => item.kind === 'external_path')
  if (external) {
    return `${input.action}::external::${external.value}`
  }
  if (isWorkspaceEditGateAction(input.action)) {
    return 'workspace_edit'
  }
  return input.action
}

export function resolveAgentGateVisibleGroupKey(
  request: Pick<AgentGateRequest, 'id' | 'sessionId' | 'kind' | 'action' | 'preview' | 'metadata'>
): string {
  const key = resolveAgentGateToolCoalesceKey({
    kind: request.kind,
    action: request.action,
    resources: extractAgentGateResourcesFromMetadata(request.metadata),
    preview: request.preview,
    metadata: request.metadata
  })
  return key ? `${request.sessionId}::${key}` : request.id
}

/** 收件箱只保留用户会看到的确认卡：同类工具并成一项。 */
export function collapseAgentGatePendingRequests<T extends AgentGateRequest>(requests: T[]): T[] {
  const groups = new Map<string, T[]>()
  const order: string[] = []
  for (const request of requests) {
    const groupKey = resolveAgentGateVisibleGroupKey(request)
    const list = groups.get(groupKey)
    if (!list) {
      groups.set(groupKey, [request])
      order.push(groupKey)
    } else {
      list.push(request)
    }
  }

  return order.map((groupKey) => {
    const items = groups.get(groupKey)!
    items.sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
      return a.id.localeCompare(b.id)
    })
    const head = items[0]!
    const uniqueIds = new Set(items.map((item) => item.id))
    const previews = mergeAgentGatePreviews(...items)
    const coalescedCount = Math.max(head.coalescedCount ?? 1, uniqueIds.size)
    const previewsChanged =
      previews.length !== (head.previews?.length ?? (head.preview ? 1 : 0)) ||
      previews.some((preview, index) => preview !== (head.previews?.[index] ?? head.preview))
    if (coalescedCount === (head.coalescedCount ?? 1) && !previewsChanged) return head
    return {
      ...head,
      coalescedCount,
      previews: previews.length > 0 ? previews : head.previews,
      preview: head.preview ?? previews[0]
    }
  })
}
