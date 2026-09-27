import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return readFileSync(join(here, rel), 'utf8')
}

describe('agent sessions modal chrome', () => {
  it('should use a content-card radius and fade instead of the oversized slick sheet', () => {
    const tsx = read('../AgentSessionsModal.tsx')
    const css = read('../AgentSessionsModal.module.css')
    expect(tsx).toContain('animation="fade"')
    expect(css).toContain('border-radius: var(--radius-md)')
    expect(css).not.toContain('--radius-xl')
  })

  it('should not nest a second white card around the session list', () => {
    const css = read('../AgentSessionsModal.module.css')
    const listWrap = css.slice(css.indexOf('.listWrap {'), css.indexOf('.listWrap > *'))
    expect(listWrap).not.toContain('border: 1px solid var(--border-card)')
    expect(listWrap).not.toContain('border-radius: 12px')
  })

  it('should use outlined Button for batch actions instead of a pill', () => {
    const tsx = read('../AgentSessionsModal.tsx')
    const css = read('../AgentSessionsModal.module.css')
    expect(tsx).toContain('import { Button, Input, Modal')
    expect(tsx).toContain('<Button')
    expect(css).not.toContain('999px')
    expect(css).not.toContain('background-color: var(--color-error)')
  })
})
