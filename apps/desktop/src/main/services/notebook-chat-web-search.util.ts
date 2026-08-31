export const NOTEBOOK_WEB_SEARCH_SYSTEM = `需要网上的最新公开信息时，调用 web_search。
已有具体链接需要阅读正文时，调用 url_read。
不要用 web_search 代替 knowledge_search 查询本笔记本资料。`

export function buildNotebookWebSearchSystem(enabled: boolean): string {
  return enabled ? NOTEBOOK_WEB_SEARCH_SYSTEM : ''
}

export function resolveNotebookWebSearchToolIds(enabled: boolean): Array<'web_search' | 'url_read'> {
  return enabled ? ['web_search', 'url_read'] : []
}
