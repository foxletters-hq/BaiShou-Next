import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../SessionListItem.module.css'),
  'utf8'
)

describe('SessionListItem chrome', () => {
  it('should use list-row weight and gray selected surface instead of a blue wash', () => {
    expect(css).toContain('font-weight: 400')
    expect(css).not.toContain('font-weight: 600')
    expect(css).toContain('background-color: var(--bg-surface-high)')
    expect(css).not.toContain('background-color: rgba(var(--color-primary-rgb)')
  })
})
