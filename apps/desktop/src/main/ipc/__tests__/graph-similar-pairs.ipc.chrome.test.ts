import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const querySrc = readFileSync(join(dir, '../graph-query.ipc.ts'), 'utf8')
const mutateSrc = readFileSync(join(dir, '../graph-mutate.ipc.ts'), 'utf8')
const writeSrc = readFileSync(join(dir, '../graph-review.write.ts'), 'utf8')
const preloadSrc = readFileSync(join(dir, '../../../preload/graph.api.ts'), 'utf8')
const dtsSrc = readFileSync(join(dir, '../../../renderer/src/global-graph-api.d.ts'), 'utf8')

describe('graph similar-pairs ipc', () => {
  it('should register list-similar-pairs on ipc, preload and GraphAPI', () => {
    expect(querySrc).toContain("'graph:list-similar-pairs'")
    expect(querySrc).toContain('listSimilarPendingPairs')
    expect(preloadSrc).toContain('listSimilarPairs')
    expect(preloadSrc).toContain("'graph:list-similar-pairs'")
    expect(dtsSrc).toContain('listSimilarPairs()')
  })

  it('should register dismiss-similar-pair without forcing pending review', () => {
    expect(mutateSrc).toContain("'graph:dismiss-similar-pair'")
    expect(preloadSrc).toContain('dismissSimilarPair')
    expect(preloadSrc).toContain("'graph:dismiss-similar-pair'")
    expect(dtsSrc).toContain('dismissSimilarPair(')
    expect(writeSrc).toContain('writeDismissSimilarPair')
    expect(writeSrc).toContain('removeSimilarPendingPeerFromProps')
    const start = writeSrc.indexOf('writeDismissSimilarPair')
    const nextExport = writeSrc.indexOf('export async function', start + 1)
    const dismissBlock = writeSrc.slice(start, nextExport > start ? nextExport : start + 800)
    expect(dismissBlock).not.toContain("reviewStatus: 'pending'")
  })
})
