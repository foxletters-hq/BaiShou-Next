/** 工作台知识库笔记本详情：/agent-workspace/knowledge/:notebookId */
export function isAgentWorkspaceKnowledgeDetailPath(pathname: string): boolean {
  return /^\/agent-workspace\/knowledge\/[^/]+$/.test(pathname)
}
