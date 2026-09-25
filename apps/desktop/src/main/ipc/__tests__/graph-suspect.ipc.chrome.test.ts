import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const querySrc = readFileSync(join(dir, '../graph-query.ipc.ts'), 'utf8')
const preloadSrc = readFileSync(join(dir, '../../../preload/graph.api.ts'), 'utf8')
const dtsSrc = readFileSync(join(dir, '../../../renderer/src/global-graph-api.d.ts'), 'utf8')
const fillSrc = readFileSync(join(dir, '../../services/pending-embed-fill.service.ts'), 'utf8')
const reviewWriteSrc = readFileSync(join(dir, '../graph-review.write.ts'), 'utf8')

describe('graph suspect ipc', () => {
  it('should register list-suspect-nodes on ipc, preload and GraphAPI', () => {
    expect(querySrc).toContain("'graph:list-suspect-nodes'")
    expect(querySrc).toContain('listSuspectNodes')
    expect(preloadSrc).toContain('listSuspectNodes')
    expect(preloadSrc).toContain("'graph:list-suspect-nodes'")
    expect(dtsSrc).toContain('listSuspectNodes()')
  })

  it('should run the suspect scan after graph extract in pending fill', () => {
    expect(fillSrc).toContain('graph_disambiguate')
    expect(fillSrc.indexOf("markPhaseDone(phases, 'graph_extract')")).toBeLessThan(
      fillSrc.indexOf('runDesktopGraphSuspectScan')
    )
    expect(fillSrc).toContain('runDesktopGraphSuspectScan')
  })

  it('should clear suspectReason when the user reviews a node', () => {
    expect(reviewWriteSrc).toContain('removeSuspectReasonFromProps')
  })
})
