import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(here, '..', 'ContextChainPanel.module.css'), 'utf8')

function rule(name: string, nextName: string): string {
  const start = css.indexOf(name)
  const end = css.indexOf(nextName)
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return css.slice(start, end)
}

describe('ContextChainPanel chrome', () => {
  it('uses chrome font tokens instead of 15px list and footer chips', () => {
    expect(rule('.title {', '.badge {')).toContain('var(--ui-fs-xl)')
    expect(rule('.footerStat {', '.footerStatIcon {')).toContain('var(--ui-fs-sm)')
    expect(rule('.roundHeaderBtn {', '.roundHeaderBtn:hover {')).toContain('var(--ui-fs-md)')
    const msgRole = css.slice(css.lastIndexOf('\n.msgRole {'), css.lastIndexOf('\n.msgPreview {'))
    const msgPreview = css.slice(
      css.lastIndexOf('\n.msgPreview {'),
      css.lastIndexOf('\n.emptyHint {')
    )
    expect(msgRole).toContain('var(--ui-fs-sm)')
    expect(msgPreview).toContain('var(--ui-fs-md)')
    expect(css).not.toContain('min-height: 62px')
    expect(css).not.toMatch(/\.msgPreview \{[^}]*font-size:\s*15px/s)
    expect(css).not.toMatch(/\.footerStat \{[^}]*font-size:\s*15px/s)
  })

  it('clips the drawer to the main content card instead of covering the titlebar', () => {
    const source = readFileSync(join(here, '..', 'ContextChainPanel.tsx'), 'utf8')
    expect(source).toContain('createPortal')
    expect(source).toContain('withAppContentOverlay(panelStyles.shell)')
    expect(rule('.shell {', '.backdropActive {')).toContain('position: fixed')
    expect(rule('.panel {', '.resizeHandle {')).toContain('position: absolute')
    expect(rule('.panel {', '.resizeHandle {')).not.toContain('position: fixed')
  })
})
