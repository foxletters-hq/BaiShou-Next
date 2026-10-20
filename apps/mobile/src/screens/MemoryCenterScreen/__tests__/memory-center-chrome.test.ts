import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const page = [
  readFileSync(join(here, '..', 'MemoryCenterScreen.tsx'), 'utf8'),
  readFileSync(join(here, '..', 'useMemoryCenterData.ts'), 'utf8'),
  readFileSync(join(here, '..', 'useMemoryCenterOrganize.ts'), 'utf8')
].join('\n')
const organizeChrome = readFileSync(join(here, '..', 'MemoryOrganizeChrome.tsx'), 'utf8')

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
    expect(page).toContain('MemoryOrganizeProgressHost')
    expect(organizeChrome).toContain('MemoryOrganizeProgressCard')
    expect(page).not.toContain('MemoryOrganizeModal')
    expect(page).toContain('graph 与 embed-then-graph 都走 batchEmbed')
    expect(page).not.toContain('getActiveVault().catch')
    expect(page).not.toContain('mobileGraphExtractQueue.enqueue')
    expect(page).not.toContain('runExtract')
  })

  it('should pop identity profile modal instead of navigating to graph tab when selfName is missing', () => {
    expect(page).toContain('SettingsProfileModal')
    expect(page).toContain('identityModalVisible')
    expect(page).toContain('handleSaveIdentityModal')
    expect(page).not.toContain("selectTab('graph')")
    expect(page).not.toContain("t('memory.need_self_name'")
    expect(page).toContain('isDefaultGraphSelfName(userProfile.nickname)')
  })

  it('should refresh organize counts when a vector fragment is deleted', () => {
    expect(page).toContain('subscribeMobilePendingEmbedCountsChanged')
    expect(page).toContain('organizePressLock.current) return')
  })

  it('should use a full-width SegmentedControl for vector passages and the relation graph', () => {
    expect(page).toContain('SegmentedControl')
    expect(page).not.toContain('stretch={false}')
    expect(page).toContain("t('memory.tab_vectors', '向量片段')")
    expect(page).toContain("t('memory.tab_graph', '关系图谱')")
  })

  it('should toast before opening the matching picker when organize needs a model', () => {
    expect(page).toContain('hasGraphModelConfigured')
    expect(page).toContain('extractConfigured')
    expect(page).toContain('resolveMemoryOrganizeConfigurePrompt')
    expect(page).toContain('openModelPicker(prompt.picker, nextProviders)')
    expect(page).not.toContain("t('memory.need_embedding_to_organize'")
  })

  it('should keep organize on a bottom-right floating start button like desktop readiness', () => {
    expect(page).not.toContain('headerRight={')
    expect(page).not.toContain("t('memory.organize_header', '整理')")
    expect(page).toContain('MemoryOrganizeFabHost')
    expect(organizeChrome).toContain('MemoryOrganizeFab')
    expect(page).toContain('tokens.spacing.lg + tokens.spacing.md')
    expect(page).toContain('void startOrganizeRef.current()')
    expect(organizeChrome).toContain("organizeFab.kind === 'loading'")
    expect(page).not.toContain('setOrganizeOpen')
    const fab = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'MemoryOrganizeFab.tsx'),
      'utf8'
    )
    expect(fab).toContain("t('memory.start_organize', '开始整理记忆')")
    expect(fab).toContain("t('memory.organize_all_done', '记忆已整理完毕')")
    expect(fab).toContain("t('memory.organize_pending_count', '待整理 {{count}} 篇'")
    expect(fab).toContain("kind === 'idle'")
    expect(fab).toContain("kind === 'pending'")
    expect(fab).toContain('StyleSheet.hairlineWidth')
    expect(organizeChrome).toContain('resolveMemoryOrganizeFabState')
    expect(page).toContain('organizeSnapshotReady')
    expect(organizeChrome).toContain('memoryOrganizePendingArticleCount')
    expect(page).toContain('peekOrganizePendingSnapshot')
    expect(page).toContain('hydrateOrganizePendingSnapshot')
    expect(page).toContain('immediateOrganizePendingSnapshot')
    expect(page).toContain('getBatchEmbedInFlight')
    expect(page).toContain("type: 'batchEmbed'")
    expect(page).toContain('pendingAppliedFromNetwork')
    expect(page).toContain('const pendingPromise = loadMemoryOrganizePending')
    expect(page).toContain('void pendingPromise.then')
    expect(fab).not.toContain("t('graph.queue_view_progress', '进度')")
    expect(fab).toContain('colors.primary')
    expect(fab).toContain('Sparkles')
    expect(fab).toContain('lucide-react-native')
    expect(fab).toContain('mobileTypography.primary.fontSize')
    expect(fab).toContain('mobileTypography.primary.fontWeight')
    expect(fab).not.toContain('getNativeElevationStyle')
    expect(fab).toContain("position: 'absolute'")
  })

  it('should show organize progress on the page with a bar, not in a modal', () => {
    const startOrganize = page.slice(
      page.indexOf('const startOrganize'),
      page.indexOf('const startOrganizeRef')
    )
    expect(startOrganize).toContain('patchCachedMobileRagState')
    expect(startOrganize).toContain("t('memory.readiness_organizing', '正在整理记忆…')")
    expect(startOrganize).not.toContain('setOrganizeOpen')
    expect(startOrganize).toContain('isMemoryOrganizeIdle')
    expect(startOrganize).toContain("t('memory.organize_nothing_pending', '无需整理')")
    expect(startOrganize).toContain('if (!organizeSnapshotReady)')
    expect(startOrganize).not.toContain('if (!organizeSnapshotReady) return')
    expect(startOrganize).toContain('const loaded = await refresh()')
    expect(startOrganize).toContain('await refresh()')
    expect(startOrganize).not.toContain('refreshInFlight.current')
    expect(startOrganize.indexOf('if (!organizeSnapshotReady)')).toBeLessThan(
      startOrganize.indexOf('resolveMemoryOrganizeAction')
    )
    expect(startOrganize.indexOf('resolveMemoryOrganizeAction')).toBeLessThan(
      startOrganize.lastIndexOf('await refresh()')
    )
    expect(startOrganize.indexOf('resolveMemoryOrganizeAction')).toBeLessThan(
      startOrganize.indexOf('isMemoryOrganizeIdle')
    )
    expect(startOrganize.indexOf('isMemoryOrganizeIdle')).toBeLessThan(
      startOrganize.indexOf('patchCachedMobileRagState')
    )
    expect(page).toContain('loadMemoryOrganizePending')
    expect(page).toContain('refreshInFlight')
    expect(startOrganize).toContain('isMemoryOrganizeCancelledError')
    expect(startOrganize).toContain("t('agent.stream_cancelled', '取消成功')")
    expect(startOrganize).toContain('toast.showSuccess')
    expect(organizeChrome).toContain('MemoryOrganizeProgressCard')
    expect(organizeChrome).toContain("organizeCardKind === 'hidden'")
    expect(organizeChrome).toContain('memoryOrganizeCardKind')
    expect(organizeChrome).toContain('readMemoryOrganizeInterrupted')
    expect(page).toContain('writeMemoryOrganizeInterrupted')
    const card = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'MemoryOrganizeProgressCard.tsx'),
      'utf8'
    )
    expect(card).toContain('memoryOrganizeProgressPercent')
    expect(card).toContain('size="sm"')
    expect(card).toContain('colors.primary')
    expect(card).toContain("t('memory.readiness_organizing', '正在整理记忆…')")
    expect(card).toContain("t('memory.organize_incomplete', '整理未完成')")
    expect(card).toContain("t('memory.organize_continue', '继续整理')")
    expect(card).not.toContain('Modal')
    expect(card).toContain("t('memory.organize_view_details', '查看详情')")
    expect(card).toContain('onViewDetails')
    expect(card).toContain('onContinue')
    expect(card).toContain("justifyContent: 'space-between'")
    expect(card).toContain('ActivityIndicator')
    expect(card).toContain('!incomplete && !props.ragState.paused')
    expect(card).not.toContain("t('settings.rag_batch_embed_pause', '暂停')")
    expect(card).not.toContain("t('settings.rag_batch_embed_cancel', '取消')")
    expect(card).toContain('detailText')
    expect(card).toContain('hasProgressCount')
    expect(card).toContain('rag_batch_embed_total_progress_label')
    expect(card).toContain('props.ragState.progress}')
    expect(card).toContain('/{props.ragState.total}')
    expect(card).toContain('organize_background_hint')
    expect(card).toContain('organize_incomplete_hint')
    expect(organizeChrome).toContain('pendingDiaryCount: input.pendingEmbedParts.diaries')
    expect(organizeChrome).toContain('AppState')
    expect(organizeChrome).toContain("nextState === 'active'")
  })

  it('should open per-type organize progress from 查看详情, not automatically on start', () => {
    expect(organizeChrome).toContain('MemoryOrganizeDetailModal')
    expect(organizeChrome).toContain('onViewDetails')
    expect(organizeChrome).toContain('setDetailOpen(true)')
    const startOrganize = page.slice(
      page.indexOf('const startOrganize'),
      page.indexOf('const startOrganizeRef')
    )
    expect(startOrganize).not.toContain('setDetailOpen(true)')
    expect(startOrganize).toContain('phase: snapshot.phase')
    expect(startOrganize).toContain('phases: snapshot.phases')
    const modal = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'MemoryOrganizeDetailModal.tsx'),
      'utf8'
    )
    expect(modal).toContain('ActivityIndicator')
    expect(modal).toContain("row.status === 'running'")
    expect(modal).toContain('memoryOrganizePhaseRows')
    expect(modal).toContain('ragBatchEmbedPhaseLabelKey')
    expect(modal).toContain('settings.rag_phase_waiting')
    expect(modal).toContain('settings.rag_phase_skipped')
    expect(modal).toContain('settings.rag_phase_done_count')
    expect(modal).toContain('onPause')
    expect(modal).toContain('onCancel')
    expect(modal).toContain('onContinue')
    expect(modal).toContain("t('memory.organize_incomplete', '整理未完成'")
    expect(modal).toContain('modalActionsStyle')
    expect(modal).toContain('flexGrow: 0')
    expect(modal).toContain("t('common.got_it', '知道了')")
    expect(modal).toContain('animationType="none"')
  })

  it('should keep organize detail state off the memory page so vectors do not re-render', () => {
    expect(page).not.toContain('setDetailOpen')
    expect(page).not.toContain('subscribeMobileRagRuntime')
    expect(organizeChrome).toContain('setDetailOpen')
    expect(organizeChrome).toContain('subscribeMobileRagRuntime')
    expect(organizeChrome).toContain('detailOpen ? (')
  })

  it('should send the user to graph pending review when suspects exist', () => {
    expect(page).toContain('useMobileSuspectCount')
    expect(page).toContain("router.push('/graph-review')")
    expect(page).toContain('memory.review_suspects')
    expect(page).not.toContain('requestGraphPendingFocus')
    expect(page).not.toContain("router.push('/graph')")
    const hook = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../hooks/useMobileSuspectCount.ts'),
      'utf8'
    )
    expect(hook).toContain('subscribeGraphDataChanged')
  })

  it('should embed the life graph screen in the graph tab instead of jumping away', () => {
    expect(page).toContain('GraphScreen')
    expect(page).toContain('embedded')
    expect(page).toContain('onUnifiedOrganize')
    expect(page).toContain('MemoryGraphPane')
    expect(page).toContain('React.memo')
    expect(page).toContain('waitForIdle')
    expect(page).not.toContain('new Error().stack')
    expect(page).not.toContain("t('nav.graph', '关系图谱')")
    expect(page).not.toContain('GraphScreenEmptyGuide')
    const scrollStart = page.indexOf('<ScrollView')
    const scrollEnd = page.indexOf('</ScrollView>')
    expect(scrollStart).toBeGreaterThan(-1)
    expect(page.slice(scrollStart, scrollEnd)).toContain('<MemoryGraphPane')
  })

  it('should collapse readiness into square model cards that open the model switcher', () => {
    expect(page).toContain('MemoryReadinessConfigModal')
    expect(page).toContain('MemoryReadinessSettingsBody')
    expect(page).toContain('ModelSwitcher')
    expect(page).toContain('filterProvidersForModelSwitcher')
    expect(page).toContain('detectDimension')
    expect(page).toContain('hideStats')
    expect(page).toContain('compactChrome')
    expect(page).toContain('settingsLead={readinessSettings}')
    expect(page).not.toContain('cardLead={readinessStatus}')
    expect(page).not.toContain('settings.rag_detect_dimension')
    expect(page).not.toContain('requestAiModelsEmbeddingFocus')
    expect(page).toContain('Array.isArray(providerList)')
    expect(page).not.toContain('rowLabel(')
    expect(page).not.toContain('params.tab as MemoryCenterTab')
    const card = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'MemoryReadinessStatusCard.tsx'),
      'utf8'
    )
    expect(card).toContain('Pressable')
    expect(card).not.toContain('<Card')
    expect(card).not.toContain('ProviderBrandIcon')
    expect(card).not.toContain('ParamCell')
    expect(card).toContain('mobileTypography.primary')
    expect(card).toContain('mobileTypography.secondary')
    expect(card).toContain('memoryVectorMetaLine')
    expect(card).not.toContain('settingsTypography.section')
    const body = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'MemoryReadinessConfigModal.tsx'),
      'utf8'
    )
    expect(body).toContain('ProviderBrandIcon')
    expect(body).toContain('aspectRatio: 1')
    expect(body).toContain('onPressEmbedding')
    expect(body).toContain('onPressExtract')
    expect(body).toContain('modalActionsStyle')
    expect(body).not.toContain('settings.rag_detect_dimension')
    expect(body).not.toContain('SettingsItem')
    expect(body).not.toContain('Array.isArray(props.rows)')

    const progressCard = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'MemoryOrganizeProgressCard.tsx'),
      'utf8'
    )
    expect(progressCard).toContain('modalActionsStyle')
    expect(progressCard).not.toContain("alignSelf: 'flex-start'")
    expect(page).toContain('modalActionsStyle')
    expect(page).not.toContain("alignSelf: 'flex-start'")
  })
})
