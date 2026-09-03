/** 工作台知识库笔记本详情：/agent-workspace/knowledge/:notebookId */
export function isAgentWorkspaceKnowledgeDetailPath(pathname: string): boolean {
  return /^\/agent-workspace\/knowledge\/[^/]+$/.test(pathname)
}

const WORKBENCH_DIRECTORY_SEGMENTS = new Set(['knowledge', 'skills', 'templates', 'projects'])

/** 工作台项目编辑页：已打开文件夹 / 会话，内层各区块已是独立圆角卡 */
export function isAgentWorkspaceEditorPath(pathname: string): boolean {
  if (!pathname.startsWith('/agent-workspace')) return false
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length < 2) return false
  const first = segments[1]
  if (first === 'open') return segments.length >= 3
  return !WORKBENCH_DIRECTORY_SEGMENTS.has(first)
}
