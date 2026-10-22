import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(dir, '..', 'DiaryPage.css'), 'utf8')

describe('diary grid overflow guard', () => {
  it('uses minmax(0, 1fr) so long content cannot widen the columns', () => {
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))')
  })

  it('lets long code lines scroll inside the card instead of expanding it', () => {
    expect(css).toMatch(/\.diary-card-content-text pre \{[^}]*overflow-x: auto/)
  })
})
