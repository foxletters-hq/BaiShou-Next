import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('knowledge citation mark chrome', () => {
  it('should hide the markdown link arrow on citation numbers', () => {
    const css = readFileSync(join(here, '..', 'MarkdownRenderer.module.css'), 'utf8')
    expect(css).toContain('a.citationMark::after')
    expect(css).toContain('content: none')
  })

  it('should keep citation links as hash anchors without opening a new tab', () => {
    const tsx = readFileSync(
      join(here, '../../AgentMarkdown/useAgentMarkdownComponents.tsx'),
      'utf8'
    )
    expect(tsx).toContain("target.startsWith('#kb-cite-')")
    expect(tsx).toContain('className={markdownStyles.citationMark}')
    expect(tsx).toContain('openFromHref(target)')
    expect(tsx).not.toContain('details.open')
    const citeBranch = tsx.slice(
      tsx.indexOf("target.startsWith('#kb-cite-')"),
      tsx.indexOf('return (', tsx.indexOf("target.startsWith('#kb-cite-')") + 1)
    )
    expect(citeBranch).not.toContain('target="_blank"')
  })
})
