import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return readFileSync(join(here, rel), 'utf8')
}

function cssBlock(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  expect(start).toBeGreaterThanOrEqual(0)
  const next = css.indexOf('\n}', start)
  return css.slice(start, next + 2)
}

describe('AgentToolsDialog chrome', () => {
  it('should size the tools sheet against the content-card overlay instead of the viewport', () => {
    const css = read('../AgentToolsView.module.css')
    const overlay = cssBlock(css, '.toolManagerOverlay')
    const modal = cssBlock(css, '.toolManagerModal')
    const container = cssBlock(css, '.containerDialog')

    expect(overlay).toContain('align-items: center')
    expect(overlay).not.toContain('flex-start')
    expect(overlay).not.toContain('80px')
    expect(modal).toContain('max-height: 100%')
    expect(modal).not.toContain('100vh')
    expect(container).not.toContain('100vh')
    expect(container).not.toContain('min-height: 440px')
  })

  it('should keep the modal body in the flex shrink chain so the tool list scrolls inside', () => {
    const css = read('../AgentToolsView.module.css')
    const bodySlot = cssBlock(css, '.toolManagerModal > div:last-child')
    const modalBody = cssBlock(css, '.toolManagerModalBody')
    const container = cssBlock(css, '.containerDialog')

    expect(bodySlot).toContain('min-height: 0')
    expect(bodySlot).toContain('overflow: hidden')
    expect(modalBody).toContain('min-height: 0')
    expect(container).toContain('min-height: 0')
  })
})
