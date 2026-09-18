import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../mobile-graph.service.ts'),
  'utf8'
)

describe('mobile graph name lookup', () => {
  it('should pick the bare-name row when find-by-name sees several candidates', () => {
    expect(src).toContain('pickBareGraphNameHit')
    expect(src).toContain('findNodesByNameOrAlias')
    const findFn = src.slice(src.indexOf('export async function mobileFindNodeByName'))
    expect(findFn).toContain('findNodesByNameOrAlias')
    expect(findFn).toContain('pickBareGraphNameHit')
    expect(findFn).toContain('ambiguous')
  })

  it('should keep single-return same-name checks when creating or renaming a node', () => {
    const upsert = src.slice(src.indexOf('export async function mobileUpsertNode'))
    const create = src.slice(src.indexOf('export async function mobileCreateNode'))
    expect(upsert).toContain('findNodeByNameOrAlias')
    expect(create).toContain('findNodeByNameOrAlias')
    expect(upsert).toContain("conflict: 'same-name'")
    expect(create).toContain("conflict: 'same-name'")
  })

  it('should carry the existing discriminator when rewriting a node on mobile', () => {
    expect(src).toContain('discriminator: existing.discriminator')
    expect(src).toContain('discriminator: node.discriminator')
    expect(src).toContain("discriminator: ''")
  })
})
