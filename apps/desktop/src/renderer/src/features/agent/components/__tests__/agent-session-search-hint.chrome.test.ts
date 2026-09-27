import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('agent session search hint chrome', () => {
  it('should tell the user that history search covers titles and message text', () => {
    const modal = readFileSync(join(here, '..', 'AgentSessionsModal.tsx'), 'utf8')
    const header = readFileSync(join(here, '..', 'AgentSidebarHeader.tsx'), 'utf8')
    expect(modal).toContain("t('agent.sidebar.search_hint', '搜索标题和对话内容')")
    expect(header).toContain("t('agent.sidebar.search_hint', '搜索标题和对话内容')")
    expect(modal).not.toContain('搜索近期聊天')
    expect(header).not.toContain('搜索近期聊天')
  })
})
