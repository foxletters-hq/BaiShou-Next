import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const page = [
  'KnowledgeDetailScreen.tsx',
  'useKnowledgeDetail.ts',
  'useKnowledgeDetailImport.ts',
  'useKnowledgeDetailSources.ts',
  'useKnowledgeDetailGraph.ts',
  'useKnowledgeDetailNotebook.ts',
  'KnowledgeDetailImportDialogs.tsx',
  'KnowledgeImportProcessDialog.tsx',
  'KnowledgeDetailJobBanner.tsx',
  'KnowledgeDetailSourcesSection.tsx',
  'KnowledgeDetailSourceCard.tsx',
  'KnowledgeOrganizeTaskCard.tsx',
  'knowledge-organize-banner.util.ts',
  'knowledge-source-card-menu.util.ts',
  'KnowledgeDetailManageSection.tsx',
  'KnowledgeDetailExtractSection.tsx',
  'KnowledgeNotebookGraphSection.tsx',
  'KnowledgeNotebookGraphReviewBar.tsx',
  'KnowledgeNotebookGraphReviewScreen.tsx',
  'KnowledgeDetailVectorsSection.tsx',
  'KnowledgeNotebookDeleteDialog.tsx',
  'KnowledgeExtractHintDialog.tsx',
  'KnowledgeSourcePreviewModal.tsx',
  'KnowledgeDetailJobBanner.tsx',
  'KnowledgeCoverEmojiPicker.tsx',
  'useKnowledgeDetailVectors.ts',
  'KnowledgeHeavyConfirmDialog.tsx',
  'KnowledgeNotebookStatusStrip.tsx',
  'KnowledgeNotebookGraphCanvasTab.tsx',
  'KnowledgeNotebookGraphAppearance.tsx',
  'useNotebookGraphAppearance.ts',
  'KnowledgeNotebookGraphPendingTab.tsx',
  'KnowledgeNotebookGraphSimilarTab.tsx',
  'KnowledgeNotebookGraphDetailCard.tsx',
  'KnowledgeNotebookGraphNodeExtras.tsx',
  'KnowledgeNotebookGraphNodeList.tsx',
  'KnowledgeNotebookGraphNodeScreen.tsx',
  'useKnowledgeNotebookGraphNode.ts',
  'KnowledgeNotebookOrganizeFab.tsx',
  'knowledge-organize-fab.util.ts',
  'knowledge-notebook-graph.util.ts',
  'KnowledgeCreateNotebookSheet.tsx'
]
  .map((name) => readFileSync(join(dir, '..', name), 'utf8'))
  .join('\n')

describe('mobile knowledge detail chrome', () => {
  it('should use native input and shared data-manage confirmation', () => {
    expect(page).toContain('canConfirmNotebookDataManage')
    expect(page).toContain('parseNotebookDataManageResult')
    expect(page).toContain('textarea')
    expect(page).not.toContain('TextInput')
    expect(page).not.toContain('Alert.alert')
    expect(page).toContain('mobileImportSource')
    expect(page).toContain('mobileManageNotebookData')
    expect(page).toContain('knowledge.status_stored_help')
    expect(page).toContain('<Tooltip content={failureReason}')
    expect(page).toContain('mobileDeleteSource')
    expect(page).toContain('knowledge.delete_source_confirm')
    expect(page).toContain('图关系和向量数据')
    expect(page).toContain('destructive: true')
  })

  it('should expose retry, re-extract graph, rebuild graph, and batch organize', () => {
    expect(page).toContain('mobileRetrySource')
    expect(page).toContain('mobileReprocessSource')
    expect(page).toContain("mobileReprocessSource(source.id, 'graph')")
    expect(page).toContain('mobileRebuildNotebookGraph')
    expect(page).toContain('mobileOrganizeNotebook')
    expect(page).not.toContain('batchEmbed')
    expect(page).toContain('knowledgeImportProcessSelectOptions')
    expect(page).toContain('import_file')
    expect(page).toContain("t('knowledge.retry'")
    expect(page).toContain("t('knowledge.reembed_graph'")
    expect(page).toContain("t('knowledge.reembed_vector'")
    expect(page).toContain("t('knowledge.data_manage'")
    expect(page).toContain('mobileProbeExtractSample')
    expect(page).toContain('mobileSearchKnowledge')
    expect(page).toContain("t('knowledge.rebuild_graph'")
    expect(page).toContain("t('graph.start_organize'")
    expect(page).toContain('onStartOrganize')
    expect(page).toContain('knowledgeSourceCanRetry')
    expect(page).toContain('knowledgeSourceCanReembedGraph')
    expect(page).toContain('manageVector')
    expect(page).toContain('manageGraph')
    expect(page).toContain('pendingEdges')
    expect(page).toContain('similarPairs')
    expect(page).toContain('GraphDesktopOnlyNotice')
    expect(page).toContain('GraphForceWebView')
    expect(page).toContain("t('graph.view_list'")
    expect(page).toContain("t('graph.view_graph'")
    expect(page).toContain('mobileCancelExtract')
    expect(page).toContain('mobileRecoverStaleIngest')
    expect(page).toContain('await mobileRecoverStaleIngest()')
    expect(page).toContain('mobileEmbedSource')
    expect(page).toContain('mobileGetExtractedPreview')
    expect(page).toContain('mobileSetKnowledgeConfig')
    expect(page).toContain('mobileListKnowledgeChunks')
    expect(page).toContain('mobileGetSourceFile')
    expect(page).toContain('mobileProbeExtractHint')
    expect(page).toContain('PageSizeSelector')
    expect(page).toContain('KnowledgeExtractHintDialog')
    expect(page).toContain('KnowledgeSourcePreviewModal')
    expect(page).toContain('KnowledgeDetailJobBanner')
    expect(page).toContain('listExtractProbeSources')
    expect(page).toContain('mobileGetKnowledgeCapabilities')
    expect(page).toContain('mobileSearchNotebookGraph')
    expect(page).toContain('graphPendingItemKey')
    expect(page).toContain('MarkdownRenderer')
    expect(page).toContain('assessFetchedWebPage')
    expect(page).toContain('listNotebookCoverEmojis')
    expect(page).toContain("t('knowledge.pick_cover_icon'")
    expect(page).toContain('visible={open}')
    expect(page).toContain('SettingsSliderRow')
    expect(page).toContain('knowledgeSourceDisplayStatus')
    expect(page).toContain('knowledgeIngestProgressLabel')
    expect(page).not.toContain('collectGraphFocusIds')
    expect(page).toContain('graph.select_all')
    expect(page).toContain('KnowledgeHeavyConfirmDialog')
    expect(page).toContain('KnowledgeNotebookStatusStrip')
    expect(page).toContain('extract_probe_empty_page')
    expect(page).toContain('graph.merge_irreversible')
    expect(page).toContain('import_process_hint_later')
    expect(page).toContain('vision_model_recommend')
    expect(page).toContain('knowledge.settings_section_extract_help_mobile')
    expect(page).not.toContain('本地 OCR')
    expect(page).not.toContain('补 OCR')
    expect(page).not.toContain('需 OCR')
    expect(page).not.toContain('OCR 中')
    expect(page).not.toContain('knowledge.ocr_missing')
    expect(page).not.toContain('import_file_hint_mobile')
    expect(page).toContain("t('graph.node_review_status'")
    expect(page).not.toContain("t('graph.tab_canvas'")
    expect(page).toContain('knowledge.graph_ops_hint')
    expect(page).toContain('loadGraphAppearanceSettings')
    expect(page).toContain('appearanceSettings')
    expect(page).toContain('forceSettings')
    expect(page).toContain('onStartOrganize')
    expect(page).toContain('graph.start_organize')
    expect(page).toContain('coverActionsRow')
    expect(page).toContain('submitActionsRow')
    expect(page).toContain("mode === 'edit'")
    expect(page).toContain("t('knowledge.edit_notebook'")
    expect(page).toContain('GraphDesktopOnlyNotice')
    expect(page).toContain('statusStrip')
    expect(page).toContain("t('knowledge.notebook_tabs'")
    expect(page).toContain("t('knowledge.tab_graph'")
    expect(page).toContain("t('knowledge.tab_vectors'")
    expect(page).toContain("activeTab === 'sources'")
    expect(page).toContain("activeTab === 'graph'")
    expect(page).toContain("activeTab === 'vectors'")
    expect(page).toContain("t('knowledge.notebook_manage'")
    expect(page).toContain("t('knowledge.data_manage'")
    expect(page).not.toContain('KnowledgeDetailCoverSection')
    expect(page).not.toContain("t('knowledge.rename_notebook'")
    expect(page).not.toContain("t('knowledge.edit_description'")
    expect(page).toContain("alignSelf: 'stretch'")
    expect(page).toContain("t('knowledge.add_source'")
    expect(page).toContain('openAddSource')
    expect(page).toContain('askImportProcess')
    expect(page).toContain("importMode === 'chooser'")
    const importDialogs = readFileSync(join(dir, '..', 'KnowledgeDetailImportDialogs.tsx'), 'utf8')
    const detailStyles = readFileSync(join(dir, '..', 'knowledge-detail.styles.ts'), 'utf8')
    expect(importDialogs).toContain('mobileTypography.primary')
    expect(importDialogs).toContain('mobileTypography.secondary')
    expect(importDialogs).toContain('iconSizes.md')
    expect(importDialogs).toContain('<Card')
    expect(importDialogs).toContain('chooserTile')
    expect(importDialogs).not.toContain('size={20}')
    expect(importDialogs).toContain('styles.importField')
    expect(importDialogs).toContain('styles.importBodyInput')
    expect(detailStyles).toMatch(/importField:[\s\S]*width: '100%'/)
    expect(detailStyles).toMatch(/importField:[\s\S]*alignSelf: 'stretch'/)
    expect(detailStyles).toMatch(
      /importBodyInput:[\s\S]*minHeight: sharedTokens\.spacing\.xxxl \* 3 \+ sharedTokens\.spacing\.xl/
    )
    expect(detailStyles).toMatch(/chooserGrid:\s*\{\s*flexDirection: 'row'/)
    expect(page).toContain('variant="settings"')
    expect(page).toContain('KnowledgeImportProcessDialog')
    expect(page).toContain('pairStatusRows')
    expect(page).toContain('statusPair')
    expect(page).not.toContain('KnowledgeDetailImportSection')
    const importHook = readFileSync(join(dir, '..', 'useKnowledgeDetailImport.ts'), 'utf8')
    expect(importHook).toContain('toast.showError(knowledgeIngestUserMessage(e, t))')
    expect(importHook).not.toContain('setError(String((e as Error)?.message || e))')
  })

  it('should use ModelSwitcher for vision models and keep extract hint actions short', () => {
    const hint = readFileSync(join(dir, '..', 'KnowledgeExtractHintDialog.tsx'), 'utf8')
    expect(hint).not.toContain('extract_hint_keep')
    expect(hint).not.toContain("t('knowledge.engine_ocr'")
    expect(hint).not.toContain("t('knowledge.engine_vision'")
    expect(hint).not.toContain('extract_hint_ocr')
    expect(hint).not.toContain('OCR')
    expect(hint).toContain('extract_hint_vision')
    expect(hint).toContain('extract_hint_open_settings')
    expect(hint).toMatch(/onChoose\('vision'\)[\s\S]*:[\s\S]*extract_hint_open_settings/)
    expect(hint).not.toMatch(/onChoose\('vision'\)[\s\S]*: null[\s\S]*extract_hint_open_settings/)
    expect(hint).toContain('extractHintActions')
    expect(page).toContain('extractHintPrompt?.visionConfigured')
    expect(page).toContain('ModelSwitcher')
    expect(page).toContain('saveVisionModel')
    expect(page).toContain('modelSwitcherSlot')
    expect(page).toContain("modelSwitcherSlot === 'embedding'")
    expect(page).toContain("modelSwitcherSlot === 'vision'")
    expect(page).toContain('applyModelSwitcher')
    expect(page).toContain('applySlotModel')
  })

  it('should keep compact dialog buttons on the right', () => {
    expect(page).toContain('modalActionsStyle')
    expect(page).not.toMatch(/flexDirection: 'row', flexWrap: 'wrap', gap: tokens\.spacing\.sm \}/)
  })

  it('should require a three-second delete countdown', () => {
    expect(page).toContain("from '@baishou/ui/native'")
    expect(page).toContain('KnowledgeNotebookDeleteDialog')
    expect(page).toContain('mobileDeleteNotebook')
    expect(page).toContain('isNotebookHeavyConfirmReady')
    expect(page).toContain('notebookHeavyConfirmSecondsLeft')
    expect(page).toContain('knowledge.delete_notebook')
    expect(page).not.toContain('#fff')
    expect(page).not.toContain('#666')
  })

  it('should not hardcode table font sizes on the notebook detail page', () => {
    expect(page).not.toMatch(/fontSize:\s*(11|13|15|16|17|32)\b/)
  })

  it('should strictly use mobileTypography instead of desktop settingsTypography', () => {
    expect(page).not.toContain('settingsTypography')
    expect(page).toContain('mobileTypography')
  })

  it('should prevent premature not-configured warning by wiring modelsLoading and caching labels', () => {
    expect(page).toContain('modelsLoading')
    expect(page).toContain('modelsLoaded')
    expect(page).toContain('peekCachedKnowledgeProcessLabels')
    expect(page).toMatch(/warn:\s*!props\.modelsLoading\s*&&\s*!props\.embeddingConfigured/)
    expect(page).toMatch(/warn:\s*!props\.modelsLoading\s*&&\s*!props\.graphConfigured/)
  })

  it('should use concise search_vectors_placeholder without ellipsis', () => {
    expect(page).toContain("t('knowledge.search_vectors_placeholder', '搜索片段')")
    expect(page).not.toContain("t('knowledge.search_vectors_placeholder', '搜索片段…')")
  })

  it('should show organize progress like memory and hide source actions behind a menu', () => {
    const banner = readFileSync(join(dir, '..', 'KnowledgeDetailJobBanner.tsx'), 'utf8')
    const sources = readFileSync(join(dir, '..', 'KnowledgeDetailSourcesSection.tsx'), 'utf8')
    const card = readFileSync(join(dir, '..', 'KnowledgeDetailSourceCard.tsx'), 'utf8')
    const detailStyles = readFileSync(join(dir, '..', 'knowledge-detail.styles.ts'), 'utf8')
    expect(sources).not.toContain('SettingsSection')
    expect(sources).not.toContain("t('knowledge.tab_sources'")
    expect(sources).toContain('borderColor: colors.borderMuted')
    expect(sources).toContain('borderRadius: tokens.radius.md')
    expect(sources).toContain('styles.statusStrip')
    expect(card).toContain('padding: tokens.spacing.md')
    expect(card).toContain('paddingRight: tokens.spacing.xl')
    expect(card).toContain('splitKnowledgeSourceErrorMessage')
    expect(card).toContain("t('knowledge.source_scan_pages'")
    expect(card).not.toContain('colors.error')
    expect(banner).toContain("kind === 'idle'")
    expect(page).toContain('leftoverBusy')
    expect(banner).toContain('ActivityIndicator')
    expect(banner).toContain("kind === 'running'")
    expect(banner).toContain("kind !== 'failed'")
    expect(banner).toContain("t('knowledge.organize_failed', '抽取失败'")
    expect(banner).toContain("t('knowledge.organize_incomplete', '整理未完成'")
    expect(banner).toContain("t('knowledge.organize_continue', '继续整理'")
    expect(banner).toContain("kind === 'paused'")
    expect(page).toContain('knowledgeOrganizeBannerKind')
    expect(page).toContain("organizeBannerKind === 'idle'")
    expect(detailStyles).toMatch(/sourceSquareBody:[\s\S]*justifyContent: 'center'/)
    expect(detailStyles).not.toMatch(/sourceSquareBody:[\s\S]*paddingTop:/)
    expect(detailStyles).toMatch(/sourceSquareMenu:[\s\S]*top: sharedTokens\.spacing\.md/)
    expect(detailStyles).toMatch(/sourceSquareMenu:[\s\S]*right: sharedTokens\.spacing\.md/)
    expect(detailStyles).toContain('sourceSquareMenuBtn')
    expect(banner).toContain('knowledgeOrganizeBannerProgress')
    expect(banner).toContain("t('knowledge.organize_progress_of'")
    expect(banner).toContain('KnowledgeOrganizeTaskCard')
    expect(banner).toContain('knowledgeOrganizeTaskActions')
    expect(banner).toContain('knowledgeOrganizeDetailSources')
    expect(banner).toContain("t('knowledge.organize_phase_embed', '向量嵌入'")
    expect(banner).toContain('detailSources.map')
    expect(banner).toContain('row.phases.map')
    expect(banner).toContain("t('knowledge.organize_phase_done', '已完成'")
    expect(banner).toContain('styles.organizePhaseBar')
    expect(banner).toContain('styles.organizePhaseValue')
    expect(banner).toContain("from './knowledge-detail.styles'")
    expect(banner).not.toContain('<View style={{ flex: 1 }} />')
    expect(detailStyles).toContain('organizePhaseBar:')
    expect(detailStyles).toContain('organizePhaseValue:')
    expect(banner).not.toContain('ocrEntries.map')
    expect(banner).not.toContain('knowledgeOrganizeDetailRows')
    expect(banner).not.toContain('marginTop: tokens.spacing.md')
    expect(banner).toContain('marginBottom: tokens.spacing.md')
    expect(page).toContain('gap: tokens.spacing.md')
    expect(page).toContain('sources={detail.sources.map')
    const vectors = readFileSync(join(dir, '..', 'KnowledgeDetailVectorsSection.tsx'), 'utf8')
    expect(vectors).not.toContain("title={t('knowledge.tab_vectors'")
    expect(vectors).not.toContain('SettingsSection')
    expect(banner).toContain('knowledgeOrganizeSourceCount')
    expect(banner).toContain("t('knowledge.organize_count', '正在整理 {{count}} 份资料'")
    expect(banner).toContain('{ count }')
    expect(banner).toContain(
      "t('knowledge.organize_progress_of', '正在整理 {{done}}/{{total}} 份资料'"
    )
    expect(banner).toContain("t('knowledge.organize_view_details', '查看详情')")
    expect(banner).not.toContain("t('knowledge.organize_count', '查看进度')")
    expect(banner).toContain('onPress={() => setOpen(true)}')
    expect(sources).not.toMatch(/<Button[\s\S]*knowledge\.source_preview/)
    expect(card).toContain('ContextMenu')
    expect(card).toContain('triggerLayout')
    expect(card).toContain('MoreVertical')
    const fab = readFileSync(join(dir, '..', 'KnowledgeNotebookOrganizeFab.tsx'), 'utf8')
    expect(fab).toContain("t('knowledge.organize_title', '正在整理')")
    expect(fab).toContain("t('knowledge.organize_all_done', '已全部整理')")
    expect(fab).toContain("t('graph.start_organize', '开始整理')")
    expect(fab).toContain("t('memory.organize_pending_count', '待整理 {{count}} 篇'")
    expect(fab).toContain("kind === 'idle'")
    expect(fab).toContain("kind === 'running'")
    expect(fab).toContain("kind === 'pending'")
    expect(fab).not.toContain("t('knowledge.status_graph_organizing'")
    expect(page).toContain('notebookOrganizeShouldKeepWatching')
    expect(page).toContain('setOrganizeWatching(true)')
    expect(page).not.toContain('logKnowledgeOrganize')
    expect(page).toContain('overlayMobileOrganizeJobsLive')
    expect(page).toContain('watching: props.watching')
    expect(page).toContain('watching={detail.organizeWatching}')
    expect(page).toContain('setOrganizeWatching')
    expect(page).toContain('result.queued > 0')
    expect(page).toContain('subscribeMobileKnowledgeIngestLive')
    expect(page).toContain('resolveNotebookOrganizeFabState')
    expect(page).toContain('sourcesReady: detail.stats !== null')
    expect(page).toContain("organizeFab.kind !== 'pending'")
    expect(page).not.toContain('pendingCount={detail.stats?.pendingJobs')
    expect(card).toContain('buildKnowledgeSourceCardMenuActions')
    expect(card).toContain("t('common.more'")
    expect(card).toContain("destructive: action === 'delete'")
    expect(card).toContain('styles.sourceSquare')
    expect(sources).toContain('pairStatusRows')
    expect(sources).toContain('chooserItem')
    expect(detailStyles).toMatch(/sourceSquare:\s*\{[\s\S]*aspectRatio: 1/)
  })

  it('should show a spinner until the initial notebook detail load completes', () => {
    const hook = readFileSync(join(dir, '..', 'useKnowledgeDetail.ts'), 'utf8')
    expect(hook).toContain('const [detailLoaded, setDetailLoaded] = useState(false)')
    expect(hook).toContain('if (!cancelled) setDetailLoaded(true)')
    expect(hook).toContain('    detailLoaded,\n')
    expect(page).toContain('!detail.detailLoaded')
    expect(page).toContain('disabled: detail.busy || !detail.detailLoaded')
  })

  it('should show a spinner on the node review page and keep select-all beside batch review', () => {
    const reviewScreen = readFileSync(
      join(dir, '..', 'KnowledgeNotebookGraphReviewScreen.tsx'),
      'utf8'
    )
    const pendingTab = readFileSync(join(dir, '..', 'KnowledgeNotebookGraphPendingTab.tsx'), 'utf8')
    expect(reviewScreen).toContain('!detail.dbReady || !detail.detailLoaded')
    expect(reviewScreen).toContain('<ActivityIndicator size="large" color={colors.primary} />')
    const batchBar = pendingTab.slice(
      pendingTab.indexOf('<View style={[styles.batchBar'),
      pendingTab.indexOf('const empty')
    )
    expect(batchBar).toContain("t('graph.select_all'")
    expect(batchBar).toContain('styles.batchSelectAll')
    expect(batchBar).toContain('styles.batchActions')
    expect(batchBar).toContain("t('graph.approve_selected'")
    expect(batchBar).toContain("t('graph.reject_selected'")
  })

  it('should align pending card checkbox with title and make the whole card tappable', () => {
    const pendingTab = readFileSync(join(dir, '..', 'KnowledgeNotebookGraphPendingTab.tsx'), 'utf8')
    const cardStart = pendingTab.indexOf('function PendingItemCard')
    const cardEnd = pendingTab.indexOf('export function KnowledgeNotebookGraphPendingTab')
    const card = pendingTab.slice(cardStart, cardEnd)
    expect(card).toContain('<Pressable')
    expect(card).toContain('onPress={() => props.onToggle(props.kind, props.id)}')
    expect(pendingTab).toContain('const PendingItemCard = memo(function PendingItemCard')
    expect(pendingTab).toContain('useCallback')
    expect(pendingTab).toContain('latest.current.onTogglePending(kind, id)')
    expect(card).toContain('accessibilityRole="checkbox"')
    expect(card).toContain("alignItems: 'flex-start'")
    expect(card).toContain('height: TITLE_LINE_HEIGHT')
    expect(card).toContain("justifyContent: 'center'")
    expect(card).toContain('lineHeight: TITLE_LINE_HEIGHT')
    expect(card).toContain('<Checkbox selected={props.selected} />')
    expect(card).not.toContain('onPress={() => props.onTogglePending')
    expect(pendingTab.match(/<PendingItemCard/g)).toHaveLength(1)
    expect(pendingTab).toContain('onToggle={handleToggle}')
  })

  it('should toast feedback when keeping similar nodes apart', () => {
    const graphHook = readFileSync(join(dir, '..', 'useKnowledgeDetailGraph.ts'), 'utf8')
    const dismissFn = graphHook.slice(
      graphHook.indexOf('const dismissSimilar'),
      graphHook.indexOf('const previewGraphFragments')
    )
    expect(dismissFn).toContain("toast.showSuccess(t('graph.similar_dismissed', '已分开保留'))")
    expect(dismissFn).toContain('toast.showError(knowledgeIngestUserMessage(e, t))')
    expect(dismissFn).not.toContain('setError(')
  })

  it('should toast every review and merge result instead of setting hidden errors', () => {
    const graphHook = readFileSync(join(dir, '..', 'useKnowledgeDetailGraph.ts'), 'utf8')
    const reviewSlice = graphHook.slice(
      graphHook.indexOf('const reviewNode'),
      graphHook.indexOf('const searchMergeNodes')
    )
    const mergeSlice = graphHook.slice(
      graphHook.indexOf('const mergeSearchedNodes'),
      graphHook.indexOf('const previewGraphFragments')
    )
    expect(reviewSlice).not.toContain('setError(')
    expect(mergeSlice).not.toContain('setError(')
    expect(graphHook).toContain('const reviewDoneMessage')
    const showError = /toast\.showError\(knowledgeIngestUserMessage\(e, t\)\)/g
    expect(reviewSlice.match(showError)).toHaveLength(4)
    expect(mergeSlice.match(showError)).toHaveLength(3)
    expect(reviewSlice).toContain('toast.showSuccess(reviewDoneMessage(status, 1))')
    expect(reviewSlice).toContain('reviewDoneMessage(status, count)')
    expect(mergeSlice.match(/t\('graph\.nodes_merged', '已合并节点'\)/g)).toHaveLength(2)
    expect(mergeSlice).toContain("toast.showSuccess(t('graph.similar_dismissed', '已分开保留'))")
  })

  it('should update batch review optimistically and sync the index in background', () => {
    const graphHook = readFileSync(join(dir, '..', 'useKnowledgeDetailGraph.ts'), 'utf8')
    const detailHook = readFileSync(join(dir, '..', 'useKnowledgeDetail.ts'), 'utf8')
    const reviewService = readFileSync(
      join(dir, '../../../services/mobile-notebook-graph-review.ts'),
      'utf8'
    )
    const selectedFn = graphHook.slice(
      graphHook.indexOf('const reviewSelectedPending'),
      graphHook.indexOf('const searchMergeNodes')
    )
    expect(selectedFn).toContain(
      'applyLocalGraphReviewBatch({ nodeIds: split.nodeIds, edgeIds: split.edgeIds, status })'
    )
    expect(selectedFn).toContain('setPendingSelection(previousSelection)')
    expect(selectedFn).not.toContain('await refreshDetail()\n      toast.showSuccess')
    expect(detailHook).toContain(
      'await mobileWaitNotebookGraphIndexSync(notebookId, activeVaultId)'
    )
    const batchFn = reviewService.slice(
      reviewService.indexOf('export async function mobileReviewNotebookGraphBatch'),
      reviewService.indexOf('export async function mobileListNotebookSimilarPendingPairs')
    )
    expect(batchFn).toContain('await commitReviewWrites(notebookId, vaultId, sink)')
    expect(batchFn).toContain('listPendingEdgesTouchingNodes(repo, vaultId, notebookId, nodeIds)')
    expect(batchFn).not.toContain('await syncNotebookGraphIndex')
  })

  it('should virtualize pending items and keep the selection checks cheap', () => {
    const pendingTab = readFileSync(join(dir, '..', 'KnowledgeNotebookGraphPendingTab.tsx'), 'utf8')
    const reviewScreen = readFileSync(
      join(dir, '..', 'KnowledgeNotebookGraphReviewScreen.tsx'),
      'utf8'
    )
    expect(pendingTab).toContain('<FlatList')
    expect(pendingTab).toContain('renderItem={renderItem}')
    expect(pendingTab).toContain(
      'if (items.length === 0 || props.pendingSelection.size < items.length) return false'
    )
    expect(pendingTab).toContain('const items = useMemo<PendingListItem[]>(')
    // 待确认走 FlatList，相似待合并才留在 ScrollView 里
    expect(reviewScreen.indexOf("tab === 'pending' ? (")).toBeLessThan(
      reviewScreen.indexOf('<KeyboardAwareScrollView')
    )
  })

  it('should query touching edges by index and commit review writes in one batch', () => {
    const reviewService = readFileSync(
      join(dir, '../../../services/mobile-notebook-graph-review.ts'),
      'utf8'
    )
    const singleFn = reviewService.slice(
      reviewService.indexOf('export async function mobileReviewNotebookGraphNode'),
      reviewService.indexOf('export async function mobileReviewNotebookGraphEdge')
    )
    expect(reviewService).toContain('repo.listEdgesTouching(vaultId, notebookId, nodeId)')
    expect(singleFn).not.toContain('listPendingEdges(')
    expect(singleFn).toContain('await commitReviewWrites(notebookId, vaultId, sink)')
    expect(reviewService).toContain("raw.writeRecords(notebookId, 'nodes'")
    expect(reviewService).toContain("raw.writeRecords(notebookId, 'edges'")
    expect(reviewService).not.toContain("writeRecord(notebookId, 'nodes'")
  })

  it('should not poll sqlite while organize is running', () => {
    const hook = readFileSync(join(dir, '..', 'useKnowledgeDetail.ts'), 'utf8')
    expect(hook).not.toContain('refreshOrganizeLive')
    expect(hook).not.toMatch(/setInterval[\s\S]*refreshDetail/)
    expect(hook).toContain('createLatestThrottled(250')
    expect(hook).toContain('unstable_batchedUpdates')
    expect(page).toContain('keyboardShouldPersistTaps="always"')
    const banner = readFileSync(join(dir, '..', 'KnowledgeDetailJobBanner.tsx'), 'utf8')
    expect(banner).toContain('hitSlop={tokens.spacing.md}')
  })

  it('should keep view-details and continue on the same row when organize is incomplete', () => {
    const banner = readFileSync(join(dir, '..', 'KnowledgeDetailJobBanner.tsx'), 'utf8')
    const viewDetails = banner.indexOf("t('knowledge.organize_view_details', '查看详情')")
    const firstContinue = banner.indexOf("t('knowledge.organize_continue', '继续整理'")
    expect(viewDetails).toBeGreaterThanOrEqual(0)
    expect(firstContinue).toBeGreaterThan(viewDetails)
    expect(firstContinue).toBeLessThan(banner.indexOf('</View>', viewDetails))
    expect(banner).toContain("flexWrap: 'nowrap'")
  })

  it('should show import extract and probe in settings, and compact data manage without tooltip', () => {
    const extractSection = readFileSync(
      join(dir, '..', 'KnowledgeDetailExtractSection.tsx'),
      'utf8'
    )
    const manageSection = readFileSync(join(dir, '..', 'KnowledgeDetailManageSection.tsx'), 'utf8')
    expect(extractSection).not.toContain("t('knowledge.settings_section_extract'")
    expect(extractSection).toContain('HelpTooltip')
    expect(extractSection).toContain('knowledge.settings_section_extract_help_mobile')
    expect(extractSection).toContain('能直接读的文字就按文件抽取。PDF 一律交给视觉模型识图。')
    expect(extractSection).toContain('knowledge.vision_model_recommend')
    expect(extractSection).toContain("t('knowledge.default_engine'")
    expect(extractSection).toContain("t('knowledge.engine_vision_short'")
    expect(extractSection).toContain("t('knowledge.ocr_concurrency'")
    expect(extractSection).toContain('listOcrConcurrencyValues')
    expect(extractSection).toContain('onOcrConcurrencyChange')
    expect(page).toContain('ocrConcurrency={detail.ocrConcurrency}')
    expect(extractSection).toContain("t('knowledge.extract_probe_test'")
    expect(extractSection).toContain("t('knowledge.extract_probe_running', '正在试抽…'")
    expect(extractSection).toContain('isLoading={props.probing}')
    expect(page).toContain('probing={detail.probing}')
    expect(extractSection).toContain('knowledge.extract_probe_help')
    expect(extractSection).toContain('第 1 页、中间页和最后一页')
    expect(extractSection).not.toContain('第 1、2 页')
    expect(extractSection).toContain('mobileTypography.secondary')
    expect(extractSection).not.toContain('mobileTypography.primary')
    expect(extractSection).not.toContain('mobileTypography.caption')
    expect(extractSection).not.toContain('extract_probe_pages')
    expect(extractSection).not.toContain('probe_need_pdf')
    expect(extractSection).toContain('variant="settings"')
    expect(manageSection).toContain("justifyContent: 'space-between'")
    expect(manageSection).toMatch(/向量片段[\s\S]*<Checkbox/)
    expect(manageSection).toMatch(/本笔记本图谱[\s\S]*<Checkbox/)
    expect(extractSection).toContain("t('knowledge.no_sources', '暂无资料'")
    expect(extractSection).not.toContain("t('knowledge.extract_probe', '试抽')")
    expect(extractSection).not.toContain('recover_stale')
    expect(extractSection).not.toContain("t('knowledge.vision_model_pick'")
    expect(extractSection).not.toContain('onPickEmbedding')
    expect(extractSection).not.toContain('onPickGraph')
    expect(extractSection).not.toContain('onPickVision')
    expect(extractSection).not.toContain('styles.statusItem')
    expect(extractSection).not.toContain('pairStatusRows')
    expect(manageSection).not.toContain('HelpTooltip')
    expect(manageSection).toContain("t('knowledge.graph_ops_hint'")
    expect(manageSection).not.toContain('graph.start_organize')
    expect(manageSection).not.toContain("t('knowledge.rebuild_graph'")
    expect(manageSection).not.toContain('onRebuildGraph')
    expect(manageSection).not.toContain('SegmentedControl')
    expect(manageSection).toContain('clearModalOpen')
    expect(manageSection).toContain('<Modal')
    expect(manageSection).toContain('clearPhrase')
    expect(manageSection).toMatch(
      /\[styles\.submitActionsRow, modalActionsStyle\][\s\S]*data_manage_reprocess[\s\S]*data_manage_clear[\s\S]*<Modal/
    )
    const detailScreen = readFileSync(join(dir, '..', 'KnowledgeDetailScreen.tsx'), 'utf8')
    expect(detailScreen).not.toContain("title={t('knowledge.notebook_manage'")
  })

  it('should close the settings and data modal after extract settings save succeeds', () => {
    const screen = readFileSync(join(dir, '..', 'KnowledgeDetailScreen.tsx'), 'utf8')
    const notebook = readFileSync(join(dir, '..', 'useKnowledgeDetailNotebook.ts'), 'utf8')
    const saveFn = notebook.slice(
      notebook.indexOf('const saveExtractConfig'),
      notebook.indexOf('const saveVisionModel')
    )
    expect(saveFn).toContain("t('common.saved', '已保存')")
    expect(saveFn).toContain('return true')
    expect(screen).not.toContain('onSave={detail.saveExtractConfig}')
    expect(screen).toMatch(/saveExtractConfig\(\)[\s\S]*setManageOpen\(false\)/)
  })

  it('should space scroll indicator from content in extracted and source preview modals like skill cite preview', () => {
    const detailScreen = readFileSync(join(dir, '..', 'KnowledgeDetailScreen.tsx'), 'utf8')
    const sourceModal = readFileSync(join(dir, '..', 'KnowledgeSourcePreviewModal.tsx'), 'utf8')
    const jobBanner = readFileSync(join(dir, '..', 'KnowledgeDetailJobBanner.tsx'), 'utf8')
    expect(detailScreen).toMatch(
      /<ScrollView[\s\S]*contentContainerStyle=\{\{\s*paddingRight:\s*tokens\.spacing\.mdTight\s*\}\}/
    )
    expect(sourceModal).toMatch(
      /<ScrollView[\s\S]*contentContainerStyle=\{\{\s*paddingRight:\s*tokens\.spacing\.mdTight\s*\}\}/
    )
    expect(jobBanner).toMatch(
      /<ScrollView[\s\S]*contentContainerStyle=\{\{\s*paddingHorizontal:\s*tokens\.spacing\.mdTight\s*\}\}/
    )
  })

  it('should align vector search loading state with RagMemoryView progressbar', () => {
    const vectorsSection = readFileSync(
      join(dir, '..', 'KnowledgeDetailVectorsSection.tsx'),
      'utf8'
    )
    expect(vectorsSection).toContain('accessibilityRole="progressbar"')
    expect(vectorsSection).toContain('<ActivityIndicator size="small" color={colors.primary} />')
    expect(vectorsSection).toContain("t('settings.rag_searching', '正在搜索…')")
  })

  it('should retry failed organize from the banner and source card without opening a menu', () => {
    const banner = readFileSync(join(dir, '..', 'KnowledgeDetailJobBanner.tsx'), 'utf8')
    const card = readFileSync(join(dir, '..', 'KnowledgeDetailSourceCard.tsx'), 'utf8')
    const sourcesSection = readFileSync(
      join(dir, '..', 'KnowledgeDetailSourcesSection.tsx'),
      'utf8'
    )
    const sourcesHook = readFileSync(join(dir, '..', 'useKnowledgeDetailSources.ts'), 'utf8')
    expect(page).toContain('onRetry={detail.startOrganize}')
    expect(banner).toContain('knowledgeOrganizeFailedMessage')
    expect(banner).toContain('knowledgeIngestUserMessage')
    expect(banner).toContain('row.hint')
    expect(banner).toContain('colors.textSecondary')
    expect(banner).toContain("t('knowledge.retry', '重试')")
    expect(banner).toContain('props.onRetry')
    expect(card).toContain('knowledgeSourceVisibleRetryKind')
    expect(card).toContain('<Button')
    expect(card).toContain("t('knowledge.retry', '重试')")
    expect(card).toContain("retryKind === 'graph'")
    expect(card).toContain('onRetryFailedGraph')
    expect(sourcesSection).toContain('onRetryFailedGraph')
    expect(sourcesHook).toContain('retryFailedGraph')
    expect(sourcesHook).toContain("mobileReprocessSource(source.id, 'graph')")
    expect(
      sourcesHook.slice(
        sourcesHook.indexOf('const retryFailedGraph'),
        sourcesHook.indexOf('const reprocessSourceGraph')
      )
    ).not.toContain('askHeavyConfirm')
    expect(page).toContain('onRetryFailedGraph={detail.retryFailedGraph}')
  })

  it('should show each organize source as a card with restart and cancel', () => {
    const banner = readFileSync(join(dir, '..', 'KnowledgeDetailJobBanner.tsx'), 'utf8')
    const card = readFileSync(join(dir, '..', 'KnowledgeOrganizeTaskCard.tsx'), 'utf8')
    const detailStyles = readFileSync(join(dir, '..', 'knowledge-detail.styles.ts'), 'utf8')
    const sourcesHook = readFileSync(join(dir, '..', 'useKnowledgeDetailSources.ts'), 'utf8')
    expect(banner).toContain('KnowledgeOrganizeTaskCard')
    expect(banner).toContain('KnowledgeOrganizeTaskActions')
    expect(banner).toContain('<Card')
    expect(banner).toContain('styles.organizeTaskCard')
    expect(detailStyles).toContain('organizeTaskCard:')
    expect(card).toContain('padding: tokens.spacing.sm')
    expect(banner).toContain('onRestartSource')
    expect(banner).toContain('onCancelSource')
    expect(banner).toContain('knowledgeOrganizeRestartTarget')
    expect(card).toContain('<Button')
    expect(card).toContain('modalActionsStyle')
    expect(card).toContain("t('knowledge.organize_restart', '重新开始')")
    expect(card).toContain("t('knowledge.organize_cancel', '取消')")
    expect(card).not.toContain('ContextMenu')
    expect(card).not.toContain('MoreVertical')
    expect(banner).toContain('[modalActionsStyle, { marginTop: 0 }]')
    expect(page).toContain('onRestartSource={detail.restartOrganizeSource}')
    expect(page).toContain('onCancelSource={detail.cancelOrganizeSource}')
    expect(sourcesHook).toContain('restartOrganizeSource')
    expect(sourcesHook).toContain('cancelOrganizeSource')
    expect(sourcesHook).toContain('mobileCancelExtract(sourceId)')
    expect(sourcesHook).toContain('mobileRetrySource(sourceId)')
    expect(sourcesHook).toContain('mobileReprocessSource(sourceId, target)')
  })

  it('should show existing graph inventory and clear the detail card when search is emptied', () => {
    const graphSection = readFileSync(join(dir, '..', 'KnowledgeNotebookGraphSection.tsx'), 'utf8')
    const reviewBar = readFileSync(join(dir, '..', 'KnowledgeNotebookGraphReviewBar.tsx'), 'utf8')
    const reviewScreen = readFileSync(
      join(dir, '..', 'KnowledgeNotebookGraphReviewScreen.tsx'),
      'utf8'
    )
    const graphHook = readFileSync(join(dir, '..', 'useKnowledgeDetailGraph.ts'), 'utf8')
    const reviewService = readFileSync(
      join(dir, '../../../services/mobile-notebook-graph-review.ts'),
      'utf8'
    )
    const reviewEdgeFn = graphHook.slice(
      graphHook.indexOf('const reviewEdge'),
      graphHook.indexOf('const reviewAllPending')
    )
    const reviewEdgeTry = reviewEdgeFn.slice(
      reviewEdgeFn.indexOf('try {'),
      reviewEdgeFn.indexOf('} catch')
    )
    expect(reviewEdgeFn).toContain("applyLocalGraphReview({ kind: 'edge'")
    expect(reviewEdgeTry).toContain('await mobileReviewNotebookGraphEdge')
    expect(reviewEdgeTry).not.toContain('refreshDetail')
    expect(reviewService).toContain('notebookGraphNodeReviewNeedsNeighborhood')
    expect(reviewService).toContain('scheduleNotebookGraphIndexSync(notebookId, vaultId)')
    expect(reviewService).not.toContain('void syncNotebookGraphIndex(')
    expect(reviewService).toContain('notebookIndexSyncs')
    const detailHook = readFileSync(join(dir, '..', 'useKnowledgeDetail.ts'), 'utf8')
    expect(detailHook.match(/import \{ applyNotebookGraphLocalReviewBatch \}/g)).toEqual([
      'import { applyNotebookGraphLocalReviewBatch }'
    ])
    const pendingTab = readFileSync(join(dir, '..', 'KnowledgeNotebookGraphPendingTab.tsx'), 'utf8')
    const similarTab = readFileSync(join(dir, '..', 'KnowledgeNotebookGraphSimilarTab.tsx'), 'utf8')
    const nodeList = readFileSync(join(dir, '..', 'KnowledgeNotebookGraphNodeList.tsx'), 'utf8')
    const searchFn = graphHook.slice(
      graphHook.indexOf('const searchGraph'),
      graphHook.indexOf('const requireVault')
    )
    expect(page).toContain('notebookGraphHasInventory')
    expect(page).toContain('shouldResetNotebookGraphSearch')
    expect(page).toContain('isCurrentNotebookGraphSearch')
    expect(graphSection).toContain("t('knowledge.graph_inventory'")
    expect(graphSection).toContain('notebookGraphHasInventory(props.nodes.length)')
    expect(searchFn).toContain('shouldResetNotebookGraphSearch')
    expect(searchFn).toContain('setSelectedGraphId(null)')
    expect(searchFn).toContain('isCurrentNotebookGraphSearch')
    expect(searchFn).not.toContain('setSelectedGraphId(ids[0])')
    expect(graphSection).toContain('KnowledgeNotebookGraphReviewBar')
    expect(graphSection).toContain("t('graph.view_list'")
    expect(graphSection).toContain("t('graph.view_graph'")
    expect(graphSection).toContain('size="small"')
    expect(graphSection).not.toContain('onLockPageScroll')
    expect(graphSection).not.toContain('onInteract')
    expect(graphSection).toContain("t('graph.settings'")
    expect(graphSection).toContain('useNotebookGraphAppearance')
    expect(graphSection).toContain('KnowledgeNotebookGraphAppearance')
    expect(graphSection).toContain('FloatingModal')
    expect(graphSection).toContain('cardStyle={{ padding: tokens.spacing.lg }}')
    expect(graphSection).toContain('paddingHorizontal: tokens.spacing.md')
    expect(graphSection).toContain('marginTop: tokens.spacing.sm')
    expect(graphSection).not.toContain('marginTop: tokens.spacing.mdPlus')
    expect(pendingTab).not.toContain("t('graph.approve_all'")
    expect(pendingTab).not.toContain("t('graph.reject_all'")
    expect(pendingTab).toContain("t('graph.approve_selected'")
    expect(pendingTab).toContain("t('graph.reject_selected'")
    expect(pendingTab).toContain("t('graph.select_all'")
    expect(reviewScreen).not.toContain('onReviewAll')
    expect(similarTab).toContain('props.onLocateNode(pair.nodeId)')
    expect(similarTab).toContain('props.onLocateNode(pair.peerId)')
    const statusStrip = readFileSync(join(dir, '..', 'KnowledgeNotebookStatusStrip.tsx'), 'utf8')
    const vectorsSection = readFileSync(
      join(dir, '..', 'KnowledgeDetailVectorsSection.tsx'),
      'utf8'
    )
    expect(statusStrip).toContain('marginTop: tokens.spacing.sm')
    expect(vectorsSection).toContain('marginTop: tokens.spacing.sm')
    expect(vectorsSection).toContain('<View style={{ gap: tokens.spacing.sm }}>')
    expect(graphSection).toContain('modalActionsStyle')
    expect(graphSection).toContain('GraphForceWebView')
    expect(page).toContain('graphViewMode')
    expect(page).not.toContain('graphCanvasFill')
    expect(page).not.toContain('graphPageLocked')
    const scrollStart = page.indexOf('<ScrollView')
    const scrollEnd = page.indexOf('</ScrollView>')
    expect(scrollStart).toBeGreaterThan(-1)
    expect(page.slice(scrollStart, scrollEnd)).toContain('<KnowledgeNotebookGraphSection')
    expect(page).toContain('viewMaxNodes={detail.viewMaxNodes}')
    expect(graphSection).not.toContain('KnowledgeNotebookGraphPendingTab')
    expect(graphSection).not.toContain('tab_reextract')
    expect(page).toContain('notebookGraphReviewCount')
    expect(page).toContain("t('graph.node_review_status'")
    expect(page).toContain("t('graph.node_review_ready'")
    expect(page).toContain("t('graph.node_review_needed'")
    expect(page).toContain('<Badge count={reviewCount} />')
    expect(graphSection).toContain('onOpenReview={props.onOpenReview}')
    expect(reviewBar).not.toContain('Modal')
    expect(reviewBar).toContain('onOpenReview')
    expect(reviewScreen).toContain('StackScreenLayout')
    expect(reviewScreen).toContain("t('graph.node_review_title'")
    expect(reviewScreen).not.toContain('size="small"')
    expect(pendingTab).toContain('modalActionsStyle')
    expect(similarTab).toContain('modalActionsStyle')
    expect(pendingTab).not.toMatch(/styles\.rowGap[\s\S]{0,80}<Button/)
    expect(similarTab).not.toMatch(/styles\.rowGap[\s\S]{0,80}<Button/)
    expect(graphSection).toContain('resolveNotebookGraphList')
    expect(graphSection).toContain('KnowledgeNotebookGraphNodeList')
    expect(graphSection).not.toContain('KnowledgeNotebookGraphDetailCard')
    expect(graphSection).toContain('onOpenNode={props.onOpenNode}')
    expect(graphSection).toContain('GraphCanvasNodePeek')
    expect(graphSection).toContain('onSelectNode={(node) => setSelectedNodeId(node.id)}')
    expect(graphSection).not.toContain('onSelectNode={(node) => props.onOpenNode(node.id)}')
    expect(nodeList).toContain('PageSizeSelector')
    expect(nodeList).toContain('Pagination')
    expect(nodeList).toContain('onPress={() => props.onOpenNode(item.id)}')
    expect(page).toContain('graphNodePage')
    expect(page).toContain('setGraphNodePage')
    expect(page).toContain('knowledgeNotebookGraphNodeHref')
    expect(page).toContain('knowledgeNotebookGraphReviewHref')
    expect(page).toContain('KnowledgeNotebookGraphReviewScreen')
    expect(page).toContain('KnowledgeNotebookGraphNodeScreen')
    expect(page).toContain('mobileGetNotebookGraphNodePage')
    expect(page).toContain('KeyboardAwareScrollView')
  })

  it('should collapse mentions and relations and merge nodes with semantic search', () => {
    const nodeScreen = readFileSync(join(dir, '..', 'KnowledgeNotebookGraphNodeScreen.tsx'), 'utf8')
    const nodeHook = readFileSync(join(dir, '..', 'useKnowledgeNotebookGraphNode.ts'), 'utf8')
    const detailCard = readFileSync(join(dir, '..', 'KnowledgeNotebookGraphDetailCard.tsx'), 'utf8')
    const extras = readFileSync(join(dir, '..', 'KnowledgeNotebookGraphNodeExtras.tsx'), 'utf8')
    expect(nodeScreen).toContain('KnowledgeNotebookGraphNodeExtras')
    expect(nodeScreen).not.toContain('KnowledgeSourcePreviewModal')
    expect(nodeScreen).not.toContain('previewFragments')
    expect(extras).not.toContain('SettingsExpansionTile')
    expect(extras).not.toContain('KnowledgeNotebookGraphFragmentsModal')
    expect(extras).not.toContain("t('knowledge.graph_fragments'")
    expect(extras).toContain('mentionsOpen')
    expect(extras).toContain('sectionLabelRow')
    expect(extras).toContain("t('graph.unfold'")
    expect(extras).toContain('<Button')
    expect(extras).toContain('graph.node_mentions')
    expect(extras).toContain('graph.node_relations')
    expect(extras).toContain('notebookGraphFragmentBody')
    expect(extras).toContain('MarkdownRenderer')
    expect(extras).toContain('modalActionsStyle')
    expect(extras).toContain('<Card key={item.id}')
    expect(detailCard).toContain('CompactSearchBar')
    expect(detailCard).toContain('modalActionsStyle')
    expect(detailCard).toContain('SegmentedControl')
    expect(detailCard).toContain("t('graph.merge_search_placeholder', '搜索要合并的节点'")
    expect(detailCard).toContain("t('settings.rag_search_semantic'")
    expect(detailCard).toContain("t('settings.rag_search_text'")
    expect(detailCard).not.toContain('searchToolbar')
    expect(detailCard).not.toContain('relatedEdges')
    expect(nodeHook).toContain('mobileSearchNotebookGraph')
    expect(nodeHook).toContain('mobileSearchNotebookGraphNodes')
    expect(nodeHook).toContain('mergeSearchMode')
    expect(nodeHook).toContain('filterNotebookGraphMergeHits')
    expect(nodeHook).toContain('collectNotebookGraphSourceWindows')
    expect(nodeHook).toContain('fragmentsLoading')
    expect(nodeHook).toContain('mergeSearched')
  })

  it('should expose all graph force sliders in the notebook canvas settings', () => {
    const appearance = readFileSync(join(dir, '..', 'KnowledgeNotebookGraphAppearance.tsx'), 'utf8')
    expect(appearance).toContain('SettingsSliderRow')
    expect(appearance).toContain('graph.force_center')
    expect(appearance).toContain('graph.force_link')
    expect(appearance).toContain('graph.force_charge')
    expect(appearance).toContain('graph.force_link_distance')
    expect(appearance).toContain('graph.hub_label_degree')
    expect(appearance).toContain('graph.hub_label_mentions')
    expect(appearance).toContain('graph.text_opacity')
    expect(appearance).toContain('graph.line_thickness')
    expect(appearance).toContain('graph.max_nodes')
    expect(appearance).toContain("t('graph.replay_layout'")
    expect(appearance).toContain("t('graph.force_reset'")
  })

  it('should refresh graph review status on return and subscribe to notebook graph changes', () => {
    const detailHook = readFileSync(join(dir, '..', 'useKnowledgeDetail.ts'), 'utf8')
    expect(detailHook).toContain("import { useFocusEffect } from '@react-navigation/native'")
    expect(detailHook).toContain('subscribeNotebookGraphChanged(notebookId')
    expect(detailHook).toContain('wasBlurred')
    expect(detailHook).toContain('blurredRef')
    expect(detailHook).not.toContain('now - lastDetailFocusTimeRef.current < 2000')
  })
})
