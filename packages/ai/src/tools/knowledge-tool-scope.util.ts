import type { ToolContext } from './agent.tool'

export function resolveKnowledgeToolNotebookId(
  context: ToolContext,
  argsNotebookId?: string
): { notebookId: string; error?: string } {
  const attached = context.workspace?.notebookId?.trim() || ''
  const isWorkspace = context.workspace?.sessionKind === 'workspace'

  if (isWorkspace) {
    if (!attached) {
      return {
        notebookId: '',
        error: '工作台尚未挂载知识库笔记本，拒绝检索。请先在工作台挂载笔记本；不可通过 notebookId 参数绕过。'
      }
    }
    return { notebookId: attached }
  }

  // 笔记本页 / 已绑定本子的对话：以上下文为准，忽略模型自带的 notebookId。
  const notebookId = attached || argsNotebookId?.trim()
  if (!notebookId) {
    return {
      notebookId: '',
      error: '当前对话没有绑定笔记本，也没有传入 notebookId。请先打开一本笔记本，不要编造资料内容。'
    }
  }
  return { notebookId }
}
