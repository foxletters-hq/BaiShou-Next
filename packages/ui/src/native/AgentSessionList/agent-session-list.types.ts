export interface AgentSession {
  id: string
  title: string
  lastMessageAt: number
  isPinned: boolean
  messageCount: number
  snippet?: string
}

export interface AgentSessionListProps {
  sessions: AgentSession[]
  onSelect: (id: string) => void
  onPin?: (id: string) => void
  onDelete?: (id: string) => void
  onRename?: (id: string, name: string) => void
  hasMore?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
  /** 受控搜索词（由外部直接走数据库标题+消息正文检索） */
  searchQuery?: string
  onSearchQueryChange?: (query: string) => void
  /** 下拉刷新状态与回调 */
  isRefreshing?: boolean
  onRefresh?: () => void
  /** 递增时滚动到列表顶部（最新会话） */
  scrollKey?: number
}
