import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getNativePaginationRange } from '../pagination.utils'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'Pagination.tsx'),
  'utf8'
)

describe('Native Pagination compact range logic', () => {
  it('renders [1, ellipsis, 5, ellipsis, 10] on page 5 of 10 with siblingCount 0', () => {
    const pages = getNativePaginationRange(5, 10, 0)
    expect(pages).toEqual([1, 'ellipsis', 5, 'ellipsis', 10])
  })

  it('renders all pages when total <= 5', () => {
    expect(getNativePaginationRange(2, 4, 0)).toEqual([1, 2, 3, 4])
    expect(getNativePaginationRange(1, 5, 0)).toEqual([1, 2, 3, 4, 5])
  })

  it('renders front pages with right ellipsis when current is near start', () => {
    expect(getNativePaginationRange(1, 10, 0)).toEqual([1, 2, 'ellipsis', 10])
    expect(getNativePaginationRange(2, 10, 0)).toEqual([1, 2, 'ellipsis', 10])
  })

  it('renders tail pages with left ellipsis when current is near end', () => {
    expect(getNativePaginationRange(9, 10, 0)).toEqual([1, 'ellipsis', 9, 10])
    expect(getNativePaginationRange(10, 10, 0)).toEqual([1, 'ellipsis', 9, 10])
  })

  it('defaults to compact siblingCount=0 and hides jumper on mobile by default', () => {
    expect(src).toContain('siblingCount = 0')
    expect(src).toContain('showJumper = false')
  })

  it('calls getNativePaginationRange and does not reference undefined getPageRange', () => {
    expect(src).toContain('getNativePaginationRange(current, total, siblingCount)')
    expect(src).not.toMatch(/\bgetPageRange\(/)
  })
})
