import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../rag-batch-embed.ipc.ts'),
  'utf8'
)

describe('rag cancel batch embed', () => {
  it('should stop the graph extract queue so organize does not keep running after cancel', () => {
    const handler = src.slice(
      src.indexOf("handle('rag:cancel-batch-embed'"),
      src.indexOf("handle('rag:get-batch-embed-state'")
    )
    expect(handler).toContain('requestBatchEmbedCancel')
    expect(handler).toContain('GraphExtractQueueService')
    expect(handler).toContain('.stop()')
  })
})
