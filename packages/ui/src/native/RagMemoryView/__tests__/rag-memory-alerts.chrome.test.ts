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
    expect(alerts).toContain('hideBatchProgress')
    expect(alerts).toContain('size="sm"')
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
    expect(actions).toContain("from '../Button'")
  })

  it('should use the same small outlined Button for index add and review actions', () => {
    expect(actions).not.toContain('TouchableOpacity')
    expect(actions).not.toContain('Library')
    expect(actions).not.toContain('MessageSquarePlus')
    expect(actions).not.toContain('actionBtn')
    expect(actions).not.toContain('colors.success')
    expect(actions).not.toContain('colors.primaryLight')
    expect((actions.match(/size="sm"/g) ?? []).length).toBe(3)
    expect((actions.match(/variant="outlined"/g) ?? []).length).toBe(3)
  })
})

const view = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'RagMemoryView.tsx'),
  'utf8'
)

describe('native RagMemoryView stats chrome', () => {
  it('should allow the memory center to hide vector count and dimension chips', () => {
    expect(view).toContain('hideStats')
    expect(view).toContain('RagMemoryStatsSection')
    expect(view).toContain('hideStats ? null')
  })

  it('should keep card lead only for the full settings layout', () => {
    expect(view).toContain('cardLead')
    expect(view).toContain('compactChrome')
    expect(view).toContain('RagMemoryCompactLayout')
  })
})

const compact = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'RagMemoryCompactLayout.tsx'),
  'utf8'
)
const settingsModal = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'RagMemorySettingsModal.tsx'),
  'utf8'
)
const styles = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'rag-memory.styles.ts'),
  'utf8'
)
const header = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'RagMemoryHeaderSection.tsx'),
  'utf8'
)
const entry = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'RagMemoryEntryCard.tsx'),
  'utf8'
)
const slider = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../settings/SettingsSliderRow.tsx'),
  'utf8'
)
const modal = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../Modal/Modal.tsx'),
  'utf8'
)

describe('native RagMemoryView compact chrome', () => {
  it('should show search and entries before the settings modal', () => {
    const body = compact.slice(compact.indexOf('return ('))
    expect(body.indexOf('RagMemorySearchSection')).toBeLessThan(
      body.indexOf('RagMemoryEntriesSection')
    )
    expect(body.indexOf('RagMemorySearchSection')).toBeLessThan(
      body.indexOf('RagMemorySettingsModal')
    )
    expect(compact).not.toContain('RagMemoryHeaderSection')
    expect(compact).not.toContain('RagMemoryRetrievalSection')
    expect(compact).toContain('hideBatchProgress')
    expect(compact).not.toContain('SettingsGroupCard')
  })

  it('should keep reminder and retrieval in settings without the enable switch or index action', () => {
    expect(settingsModal).toContain('RagMemoryHeaderSection')
    expect(settingsModal).toContain('RagMemoryRetrievalSection')
    expect(settingsModal).toContain('settingsLead')
    expect(settingsModal).toContain('showEnableSwitch={false}')
    expect(settingsModal).not.toContain('RagMemoryActionsSection')
    expect(settingsModal).not.toContain('onBatchEmbed')
  })

  it('should inset the settings scroll indicator like SkillCitePreviewDialog', () => {
    expect(settingsModal).toContain('keyboardShouldPersistTaps="handled"')
    expect(settingsModal).toContain('paddingRight: sharedTokens.spacing.mdTight')
  })
})

describe('native RagMemoryView typography', () => {
  it('should use mobileTypography instead of scattered font sizes', () => {
    expect(styles).toContain("from '../../theme/tokens'")
    expect(styles).toContain('mobileTypography')
    expect(styles).not.toMatch(/fontSize:\s*(?:11|12|13|14|18)\b/)
    expect(header).toContain('mobileTypography.primary')
    expect(header).toContain('mobileTypography.secondary')
    expect(header).toContain('showEnableSwitch')
    expect(header).not.toContain('cardStyles.cardTitle')
    expect(entry).not.toMatch(/fontSize:\s*(?:11|12|13|14|18)\b/)
    expect(entry).toContain('size="sm"')
  })

  it('should render each vector fragment as a white card and keep view-full in the more menu', () => {
    expect(entry).toContain("from '../Card'")
    expect(entry).toContain('<Card')
    expect(entry).toContain('colors.bgSurface')
    expect(entry).toContain('colors.borderMuted')
    expect(entry).toContain('ContextMenu')
    expect(entry).toContain("t('settings.rag_view_entry', '查看完整片段')")
    expect(entry).not.toContain('Button variant="outlined" size="sm" onPress={openPreview}')
    expect(entry).not.toContain('{ }')
    expect(entry).not.toContain('bgSurfaceHigh')
    expect(entry).toContain('measureInWindow')
  })

  it('should put the kind tag on the first row left of the menu with a slightly larger rounded background', () => {
    const header = entry.slice(
      entry.indexOf('<View style={styles.entryHeader}>'),
      entry.indexOf('<ContextMenu')
    )
    expect(header).toContain('entryKindBadge')
    expect(header.indexOf('entryKindBadge')).toBeLessThan(header.indexOf('menuTriggerRef'))
    expect(entry).not.toContain('entryMetaBadge')
    expect(styles).toContain('sharedTokens.radius.xs')
    expect(styles).toContain('sharedTokens.spacing.sm')
    expect(styles).toContain('sharedTokens.spacing.xs')
    expect(styles).toContain('entryKindBadge')
  })

  it('should right-align modal actions and buttons with modalActionsStyle', () => {
    expect(entry).toContain('modalActionsStyle')
    expect(entry).not.toContain("alignSelf: 'flex-start'")
    expect(header).toContain('modalActionsStyle')
    expect(header).not.toContain("alignSelf: 'flex-start'")
    expect(settingsModal).toContain('modalActionsStyle')
  })
})

describe('native settings slider and modal chrome', () => {
  it('should keep slider text close to the track and use settings typography', () => {
    expect(slider).toContain('mobileTypography')
    expect(slider).not.toContain('marginBottom: 8')
    expect(slider).not.toContain('paddingVertical: 8')
  })

  it('should use the medium card radius for centered modals', () => {
    expect(modal).toContain('tokens.radius.md')
    expect(modal).not.toContain('tokens.radius.xl')
    expect(modal).toContain('mobileTypography.title')
  })
})

const search = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'RagMemorySearchSection.tsx'),
  'utf8'
)

describe('native RagMemorySearchSection chrome', () => {
  it('should use a short memory placeholder and the official compact segmented control', () => {
    expect(search).toContain("t('settings.rag_search_placeholder', '搜索记忆')")
    expect(search).not.toContain('rag_search_semantic_hint')
    expect(search).not.toContain('rag_search_text_hint')
    expect(search).toContain('SegmentedControl')
    expect(search).toContain('size="small"')
    expect(search).toContain('stretch={false}')
    expect(search).not.toContain('segmentBtn')
    expect(search).not.toContain('styles.segmented')
  })

  it('should keep the search field and mode switch on one vertically centered row', () => {
    expect(search).toMatch(/toolbar:\s*\{[^}]*alignItems: 'center'/)
    expect(search).toMatch(/searchBox:\s*\{[^}]*height: 34/)
    expect(search).toMatch(/searchBox:\s*\{[^}]*alignItems: 'center'/)
  })
})
