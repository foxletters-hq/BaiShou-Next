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

  it('should use surface colors for organize progress cards', () => {
    expect(alerts).toContain('backgroundColor: colors.bgSurface')
    expect(alerts).toContain('borderColor: colors.borderMuted')
    expect(alerts).toContain('color: colors.textPrimary')
    expect(alerts).not.toContain('backgroundColor: colors.primaryLight')
  })

  it('should offer a review action when suspect nodes need confirmation', () => {
    expect(alerts).toContain('memory.suspects_need_review')
    expect(alerts).toContain('memory.review_suspects')
    expect(alerts).toContain('onReviewSuspects')
  })
})

const actions = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'RagMemoryActionsSection.tsx'),
  'utf8'
)

describe('native RagMemoryActionsSection suspect chrome', () => {
  it('should keep suspect review next to memory actions', () => {
    expect(actions).toContain('onReviewSuspects')
    expect(actions).toContain('memory.review_suspects_toolbar')
    expect(actions).toContain('检查待确认节点')
    expect(actions).not.toContain('检查可疑节点')
    expect(actions).toContain('from \'../Button\'')
  })
})
