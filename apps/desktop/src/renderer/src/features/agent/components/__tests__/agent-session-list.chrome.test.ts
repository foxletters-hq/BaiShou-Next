import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const tsx = readFileSync(join(here, '../AgentSessionList.tsx'), 'utf8')
const css = readFileSync(join(here, '../AgentSessionList.module.css'), 'utf8')

describe('agent session list chrome', () => {
  it('should use an outlined Button for load more instead of a primary text link', () => {
    expect(tsx).toContain('<Button')
    expect(tsx).toContain("t('agent.sidebar.load_more', '加载更多对话')")
    expect(css).not.toContain('color: var(--color-primary)')
  })

  it('should keep group headers as solid surface labels without a fade mask', () => {
    expect(css).not.toContain('linear-gradient')
    expect(css).toContain('font-size: var(--ui-fs-sm)')
    expect(css).toContain('font-weight: 500')
  })
})
