import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const page = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'MemoryCenterScreen.tsx'),
  'utf8'
)

describe('mobile memory center chrome', () => {
  it('should drive organize from shared phase snapshot and batch embed', () => {
    expect(page).toContain('snapshotMemoryEmbedPhases')
    expect(page).toContain('batchEmbed')
    expect(page).toContain('resolveMemoryOrganizeAction')
    expect(page).toContain('writeMemoryOnboardingDismissed')
    expect(page).toContain('readActiveVaultSafely')
    expect(page).toContain('normalizeMemoryCenterRagConfig')
    expect(page).toContain('loadMemoryOrganizePending')
    expect(page).toContain('ensureMobileGraphSelfName')
    expect(page).toContain('MemoryOrganizeModal')
    expect(page).toContain('graph 与 embed-then-graph 都走 batchEmbed')
    expect(page).not.toContain('getActiveVault().catch')
    expect(page).not.toContain('mobileGraphExtractQueue.enqueue')
    expect(page).not.toContain('runExtract')
  })

  it('should refresh organize counts when a vector fragment is deleted', () => {
    expect(page).toContain('subscribeMobilePendingEmbedCountsChanged')
  })

  it('should send the user to graph pending review when suspects exist', () => {
    expect(page).toContain('useMobileSuspectCount')
    expect(page).toContain('requestGraphPendingFocus')
    expect(page).toContain('memory.review_suspects')
  })

  it('should collapse readiness into a config viewer and send missing embedding to global models', () => {
    expect(page).toContain('MemoryReadinessStatusCard')
    expect(page).toContain('MemoryReadinessConfigModal')
    expect(page).toContain('requestAiModelsEmbeddingFocus')
    expect(page).toContain('hideStats')
    expect(page).toContain('cardLead={readinessStatus}')
    expect(page).toContain('SettingsGroupCard')
    expect(page).toContain('SettingsCardDivider')
    expect(page).toContain('Array.isArray(providerList)')
    expect(page).not.toContain('rowLabel(')
    expect(page).not.toContain('params.tab as MemoryCenterTab')
    const card = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'MemoryReadinessStatusCard.tsx'),
      'utf8'
    )
    expect(card).toContain('ProviderBrandIcon')
    expect(card).toContain('Pressable')
    expect(card).not.toContain('<Card')
    expect(card).toContain('settingsCardStyles.label')
    expect(card).toContain('settingsCardStyles.hint')
    expect(card).not.toContain('settingsTypography.section')
    expect(card).toContain('memoryReadinessRowById')
    expect(card).toContain('Array.isArray(props.providers)')
    const modal = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'MemoryReadinessConfigModal.tsx'),
      'utf8'
    )
    expect(modal).toContain('ProviderBrandIcon')
    expect(modal).toContain('settings.rag_detect_dimension')
    expect(modal).toContain('memoryVectorMetaLine')
    expect(modal).toContain('Array.isArray(props.rows)')
  })
})
