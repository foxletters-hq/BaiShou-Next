import { parseMountedNotebookIds, resolveWorkspaceNotebookIds } from '@baishou/shared'
import type { ToolContext } from './agent.tool'

export function resolveKnowledgeToolNotebookIds(
  context: ToolContext,
  argsNotebookId?: string
): { notebookIds: string[]; error?: string } {
  const mounted = resolveWorkspaceNotebookIds(context.workspace)
  if (mounted.length === 0) {
    return {
      notebookIds: [],
      error:
        '当前对话尚未挂载知识库笔记本，拒绝检索。请先挂载笔记本；不可通过 notebookId 参数绕过。'
    }
  }

  const requested = parseMountedNotebookIds(argsNotebookId)
  if (requested.length === 0) {
    return { notebookIds: mounted }
  }

  const allowed = new Set(mounted)
  const invalid = requested.filter((id) => !allowed.has(id))
  if (invalid.length > 0) {
    return {
      notebookIds: [],
      error: `notebookId「${invalid.join('、')}」不在已挂载集合中，拒绝检索。请只检索已挂载的笔记本。`
    }
  }
  return { notebookIds: requested }
}
