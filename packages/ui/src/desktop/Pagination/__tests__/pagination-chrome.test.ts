import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'Pagination.module.css'),
  'utf8'
)

describe('Pagination chrome', () => {
  it('should keep the jumper on one 32px row instead of overflowing vertically', () => {
    const paginationRule = css.slice(css.indexOf('.pagination {'), css.indexOf('.pageBtn {'))
    expect(paginationRule).toContain('flex-wrap: nowrap')
    expect(paginationRule).toContain('align-items: center')
    const jumperInputRule = css.slice(css.indexOf('.jumperInput {'), css.indexOf('.jumperInput::placeholder'))
    expect(jumperInputRule).toContain('height: 32px')
    expect(jumperInputRule).toContain('max-height: 32px')
    expect(jumperInputRule).toContain('width: 44px')
  })
})
