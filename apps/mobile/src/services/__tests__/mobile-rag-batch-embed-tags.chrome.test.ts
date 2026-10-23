import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'mobile-rag-batch-embed.helpers.ts'),
  'utf8'
)

describe('mobile rag batch embed diary tags', () => {
  it('should read tags from the loaded diary row instead of the detection row', () => {
    expect(src).toContain('tags: []')
    expect(src).not.toContain('resolveDiaryEmbedTagsFromLoadedRow(diary)')
    expect(src).not.toContain('meta.tags')
  })

  it('should still run pending fill when diary backlog is zero', () => {
    expect(src).toContain('runPendingFillAfterDiaryBatch')
    expect(src.indexOf('if (globalTotal === 0)')).toBeLessThan(
      src.indexOf("skipReason: 'nothing-to-embed'")
    )
    expect(src.indexOf('runPendingFillAfterDiaryBatch(deps, onProgress)')).toBeLessThan(
      src.indexOf("skipReason: 'nothing-to-embed'")
    )
  })

  it('should freeze diary phase progress and pass fill phase rows through', () => {
    expect(src).toContain('applyFrozenPhaseProgress')
    expect(src).toContain("applyFrozenPhaseProgress(phases, 'diary'")
    expect(src).toContain('getOrganizePendingSnapshot')
    expect(src).toContain('status: statusText, phase, phases')
    expect(src).toContain('contentHash: meta.contentHash')
    expect(src).toContain('notifyMobilePendingEmbedCountsChanged')
    const core = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'mobile-rag-core.helpers.ts'),
      'utf8'
    )
    expect(core).toContain('phase?:')
    expect(core).toContain('phases?:')
    expect(core).toContain('progress.phase')
    expect(core).toContain('progress.phases')
    expect(core).toContain('hashEmbedSourceContent')
    expect(core).not.toContain('digestStringAsync')
  })
})
