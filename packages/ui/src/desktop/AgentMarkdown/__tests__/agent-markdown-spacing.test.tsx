import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { AgentMarkdownRenderer } from '../AgentMarkdownRenderer'
import { agentMarkedConfig } from '../agent-markdown.config'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(here, '../AgentMarkdownRenderer.module.css'), 'utf8')

describe('Desktop AgentMarkdown natural line and paragraph spacing', () => {
  it('enables GFM soft line breaks so single newlines break lines naturally', () => {
    expect(agentMarkedConfig.breaks).toBe(true)
  })

  it('renders semantic <p> paragraphs for normal markdown and preserves single-line <br> breaks', () => {
    const { container } = render(
      <AgentMarkdownRenderer content={'第一段第一行\n第一段第二行\n\n第二段内容'} />
    )

    const paragraphs = container.querySelectorAll('.x-markdown p')
    expect(paragraphs.length).toBe(2)
    expect(paragraphs[0]?.querySelector('br')).toBeTruthy()
  })

  it('defines natural line-height and paragraph/list spacing in CSS', () => {
    expect(css).toContain('line-height: 1.75;')
    expect(css).toContain('--margin-block: 0 0 var(--spacing-sm-plus) 0;')
    expect(css).toContain('.root:global(.x-markdown) p,')
  })
})
