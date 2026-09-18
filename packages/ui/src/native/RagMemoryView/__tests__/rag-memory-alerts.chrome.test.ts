import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const alerts = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'RagMemoryAlerts.tsx'),
  'utf8'
)

describe('native RagMemoryAlerts batch embed chrome', () => {
  it('should expose pause resume and cancel actions when batch embedding', () => {
    expect(alerts).toContain('onPauseBatchEmbed')
    expect(alerts).toContain('onResumeBatchEmbed')
    expect(alerts).toContain('onCancelBatchEmbed')
    expect(alerts).toContain('settings.rag_batch_embed_pause')
    expect(alerts).toContain('settings.rag_batch_embed_resume')
    expect(alerts).toContain('settings.rag_batch_embed_paused')
  })
})
