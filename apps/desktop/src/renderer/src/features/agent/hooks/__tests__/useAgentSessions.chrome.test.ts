import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { SESSION_PAGE_SIZE } from '../useAgentSessions'

const here = dirname(fileURLToPath(import.meta.url))
const hookSrc = readFileSync(join(here, '../useAgentSessions.ts'), 'utf8')
const listSrc = readFileSync(join(here, '../../components/AgentSessionList.tsx'), 'utf8')
const ipcSrc = readFileSync(join(here, '../../../../../../main/ipc/agent-session.ipc.ts'), 'utf8')

describe('desktop useAgentSessions & branch session chrome', () => {
  it('使用每页 20 条分页，并按实际切片 page.length 递增 offset（避免每页漏掉第 N+1 条）', () => {
    expect(SESSION_PAGE_SIZE).toBe(20)
    expect(hookSrc).toContain('sessionsLoadedFromDbRef.current = page.length')
    expect(hookSrc).toContain('sessionsLoadedFromDbRef.current += page.length')
    expect(hookSrc).not.toContain('sessionsLoadedFromDbRef.current = data.length')
    expect(hookSrc).not.toContain('sessionsLoadedFromDbRef.current += data.length')
  })

  it('session:file-changed 刷新时保留已分页加载的条数并支持滚动触底自动加载', () => {
    expect(hookSrc).toContain('preserveLoadedCount: true')
    expect(listSrc).toContain('onScroll={handleScroll}')
    expect(listSrc).toContain('el.scrollHeight - el.scrollTop - el.clientHeight <= 80')
  })

  it('桌面端创建分支会话时携带分支点摘要并保留原消息 createdAt 时间戳', () => {
    expect(ipcSrc).toContain('buildBranchSessionTitle')
    expect(ipcSrc).toContain('extractMessagePlainTextSnippet(targetParts)')
    expect(ipcSrc).toContain('createdAt: (msg as any).createdAt ?? undefined')
  })
})
