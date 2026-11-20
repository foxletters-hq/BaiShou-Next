import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const hookSrc = readFileSync(join(here, '../useAgentSessions.ts'), 'utf8')
const drawerSrc = readFileSync(join(here, '../../components/AgentDrawer.tsx'), 'utf8')
const screenSessionSrc = readFileSync(
  join(here, '../../screens/AgentScreen/hooks/useAgentScreenSession.ts'),
  'utf8'
)
const listScrollSrc = readFileSync(
  join(here, '../../screens/AgentScreen/hooks/useAgentListScroll.ts'),
  'utf8'
)

describe('mobile useAgentSessions pagination & search chrome', () => {
  it('使用每页 20 条分页，并按实际切片 page.length 递增 offset（避免每页漏掉第 N+1 条）', () => {
    expect(hookSrc).toContain('export const SESSION_PAGE_SIZE = 20')
    expect(hookSrc).toContain('sessionsLoadedFromDbRef.current = page.length')
    expect(hookSrc).toContain('sessionsLoadedFromDbRef.current += page.length')
    expect(hookSrc).not.toContain('sessionsLoadedFromDbRef.current = sessionList.length')
    expect(hookSrc).not.toContain('sessionsLoadedFromDbRef.current += sessionList.length')
  })

  it('将搜索词传给 sessionManager.list 走数据库检索，并映射 snippet 消息摘要', () => {
    expect(hookSrc).toContain('const normalizedQuery = searchQueryRef.current.trim() || undefined')
    expect(hookSrc).toContain('snippet: s.snippet ?? undefined')
    expect(drawerSrc).toContain('searchQuery={sessionSearchQuery}')
    expect(drawerSrc).toContain('onSearchQueryChange={onSessionSearchQueryChange}')
    expect(drawerSrc).toContain('isRefreshing={isRefreshingSessions}')
    expect(drawerSrc).toContain('onRefresh={onRefreshSessions}')
  })

  it('后台会话事件与抽屉打开时保留已加载分页深度（preserveLoadedCount: true）', () => {
    expect(hookSrc).toContain('preserveLoadedCount: true')
    expect(screenSessionSrc).toContain('preserveLoadedCount: true')
    expect(screenSessionSrc).toContain('}, 280)')
  })

  it('会话内向上滑动/拖拽到顶部时自动触发加载更早对话，并在前置插入后锚定滚动偏移', () => {
    expect(listScrollSrc).toContain('handleLoadMoreWithAnchor')
    expect(listScrollSrc).toContain('pendingPrependAnchorRef')
    expect(listScrollSrc).toContain('const deltaHeight = height - pendingAnchor.prevHeight')
    expect(listScrollSrc).toContain(
      'flatListRef.current?.scrollTo({ y: targetOffsetY, animated: false })'
    )
    expect(listScrollSrc).toContain('handleListScrollEndDrag')
  })

  it('使用 resolveMobileActiveVaultId 防止 activeVault.id 为空串时触发 fail-closed 拦截', () => {
    expect(hookSrc).toContain('resolveMobileActiveVaultId(services)')
    expect(hookSrc).not.toContain('activeVault?.id ??')
  })

  it('使用 resolveMobileSessionVaultCandidateIds 计算候选小窝 ID，不在多小窝下无条件混入 Personal 会话', () => {
    expect(hookSrc).toContain('resolveMobileSessionVaultCandidateIds(services)')
    expect(hookSrc).not.toContain("deriveLegacyVaultId('Personal')")
  })

  it('小窝切换期间清空会话列表并阻断加载，防止跨小窝列表残留', () => {
    expect(hookSrc).toContain('vaultSwitching')
    expect(hookSrc).toContain('if (!dbReady || !services || vaultSwitching) return')
  })
})
