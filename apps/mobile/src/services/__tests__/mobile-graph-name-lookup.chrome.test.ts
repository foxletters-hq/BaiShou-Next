import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const querySrc = readFileSync(join(dir, '../mobile-graph-query.ts'), 'utf8')
const mutateSrc = readFileSync(join(dir, '../mobile-graph-mutate.ts'), 'utf8')

describe('mobile graph name lookup', () => {
  it('should pick the bare-name row when find-by-name sees several candidates', () => {
    expect(querySrc).toContain('pickBareGraphNameHit')
    expect(querySrc).toContain('findNodesByNameOrAlias')
    const findFn = querySrc.slice(querySrc.indexOf('export async function mobileFindNodeByName'))
    expect(findFn).toContain('findNodesByNameOrAlias')
    expect(findFn).toContain('pickBareGraphNameHit')
    expect(findFn).toContain('ambiguous')
  })

  it('should filter same-name hits by discriminator when creating or renaming a node', () => {
    const upsert = mutateSrc.slice(mutateSrc.indexOf('export async function mobileUpsertNode'))
    const create = mutateSrc.slice(mutateSrc.indexOf('export async function mobileCreateNode'))
    expect(upsert).toContain('findNodesByNameOrAlias')
    expect(create).toContain('findNodesByNameOrAlias')
    expect(upsert).toContain('pickSameNameConflictFromHits')
    expect(create).toContain('pickSameNameConflictFromHits')
    expect(upsert).not.toContain('findNodeByNameOrAlias')
    expect(create).not.toContain('findNodeByNameOrAlias')
    expect(upsert).toContain("conflict: 'same-name'")
    expect(create).toContain("conflict: 'same-name'")
  })

  it('should carry the existing discriminator when rewriting a node on mobile', () => {
    expect(mutateSrc).toContain('discriminator: existing.discriminator')
    expect(mutateSrc).toContain("discriminator: ''")
  })
})
