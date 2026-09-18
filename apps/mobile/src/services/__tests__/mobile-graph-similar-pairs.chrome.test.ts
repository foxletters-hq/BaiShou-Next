import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const querySrc = readFileSync(join(dir, '../mobile-graph-query.ts'), 'utf8')
const reviewSrc = readFileSync(join(dir, '../mobile-graph-review.ts'), 'utf8')
const serviceSrc = readFileSync(join(dir, '../mobile-graph.service.ts'), 'utf8')

describe('mobile graph similar pairs', () => {
  it('should expose list and dismiss without forcing pending review', () => {
    expect(querySrc).toContain('export async function mobileListSimilarPairs')
    expect(querySrc).toContain('listSimilarPendingPairs')
    expect(reviewSrc).toContain('export async function mobileDismissSimilarPair')
    expect(reviewSrc).toContain('removeSimilarPendingPeerFromProps')
    expect(serviceSrc).toContain('mobileListSimilarPairs')
    expect(serviceSrc).toContain('mobileDismissSimilarPair')
    const start = reviewSrc.indexOf('mobileDismissSimilarPair')
    const nextExport = reviewSrc.indexOf('export async function', start + 1)
    const dismissBlock = reviewSrc.slice(start, nextExport > start ? nextExport : start + 800)
    expect(dismissBlock).not.toContain("reviewStatus: 'pending'")
  })
})
