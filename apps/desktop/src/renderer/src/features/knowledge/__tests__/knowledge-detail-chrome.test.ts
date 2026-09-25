import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const knowledgeDir = join(here, '..')

function readKnowledge(fileName: string): string {
  return readFileSync(join(knowledgeDir, fileName), 'utf8')
}

function readKnowledgeDetailChrome(): string {
  return [
    'KnowledgeDetailPage.tsx',
    'KnowledgeSourceCards.tsx',
    'KnowledgeSourceFileIcon.tsx',
    'KnowledgeDetailJobBanner.tsx',
    'KnowledgeDetailSettingsDialog.tsx',
    'KnowledgeDetailImportDialogs.tsx',
    'KnowledgeDetailHostDialogs.tsx',
    'KnowledgeSourceFragmentDialog.tsx',
    'knowledge-detail-labels.util.ts',
    'useKnowledgeDetailRefresh.ts',
    'useKnowledgeDetailImport.ts',
    'useKnowledgeDetailActions.ts',
    'useKnowledgeDetailPreview.ts',
    'knowledge-detail-source-menu.util.ts'
  ]
    .map(readKnowledge)
    .join('\n')
}

function readNotebookGraphChrome(): string {
  return [
    'NotebookGraphPane.tsx',
    'NotebookGraphToolbar.tsx',
    'NotebookGraphDetailTab.tsx',
    'NotebookGraphSidePanel.tsx',
    'NotebookGraphOverlays.tsx',
    'useNotebookGraphMerge.ts'
  ]
    .map(readKnowledge)
    .join('\n')
}

describe('knowledge detail chrome', () => {
  it('should keep model status in the sources page instead of an open dialog', () => {
    const page = readKnowledgeDetailChrome()
    const css = readKnowledge('KnowledgePage.module.css')

    const panel = readKnowledge('NotebookStatusPanel.tsx')
    const panelCss = readKnowledge('NotebookStatusPanel.module.css')

    expect(page).toContain('<NotebookStatusPanel')
    expect(page).toContain('onPickRow={pickStatusRow}')
    expect(page).toContain('resolveGlobalGraphModelIds')
    expect(page).toContain('graphModelId: extract.modelId')
    expect(page).toContain('persistReasoningSlot')
    expect(readKnowledge('KnowledgeModelMenu.tsx')).toContain("kind !== 'embedding'")
    expect(readKnowledge('KnowledgeModelMenu.tsx')).not.toContain('showReasoningPanel={false}')
    expect(page).toContain('styles.sourcesStage')
    expect(page).toContain('<NotebookDataManageDialog')
    expect(page).toContain('notebookDataManageStatusKind')
    expect(page).toContain('notebookDataManageFeedback')
    expect(page).toContain('setReprocessWatching')
    expect(page).toContain('toast.showInfo')
    expect(page).toContain('data_manage_reprocess_empty')
    expect(page).not.toContain('onStartChat')
    expect(page).not.toContain('sourcesToolbar')
    expect(page).not.toContain('start_chat')
    expect(panel).toContain("t('knowledge.notebook_manage', '笔记本管理')")
    expect(panel).toContain("t('knowledge.data_manage', '数据管理')")
    expect(panel).not.toContain('start_chat')
    expect(panelCss).toMatch(/\.actions \{[^}]*flex-direction: column/)
    expect(page).not.toContain('NotebookOpenGuideDialog')
    expect(page).not.toContain('shouldShowNotebookOpenGuide')
    expect(page).not.toContain('setGuideOpen')
    expect(page).not.toContain('reset_dont_ask_again')
    expect(page).not.toContain("title={t('knowledge.rebuild_index'")
    expect(page).not.toContain('<RefreshCw')
    expect(page).toContain('styles.createCard')
    expect(page).toContain('styles.listGrid')
    expect(page).toContain('styles.sourceCard')
    expect(page).toContain('styles.organizeCompact')
    expect(page).toContain('pickSourceCardEvidence')
    expect(page).toContain('sourceCardFailureReason')
    expect(page).toContain('knowledgeIngestUserMessage')
    expect(readKnowledge('knowledge-ingest-user-error.util.ts')).toContain('source_not_embedded')
    expect(readKnowledge('knowledge-ingest-user-error.util.ts')).toContain(
      'graph_extract_not_configured'
    )
    expect(page).toContain("t('knowledge.organize_failed', '抽取失败')")
    expect(page).toContain("t('knowledge.organize_failed_graph_nodes', '节点向量失败')")
    expect(page).toContain('jobProgress.error')
    expect(page).toContain('failedSourceTitle')
    expect(page).toContain('lastError')
    expect(page).toContain('<Tooltip')
    expect(page).not.toContain("evidence?.type === 'error'")
    expect(page).toContain('notebookOrganizeProgressCopy')
    expect(page).toContain('knowledgeIngestProgressLabel')
    expect(page).toContain('organizeCompact')
    expect(page).toContain("t('knowledge.organize_title', '正在整理')")
    expect(page).toContain("t('knowledge.status_graph_organizing', '正在整理图谱')")
    expect(readKnowledge('KnowledgeSourceCards.tsx')).toContain('knowledgeSourceDisplayStatus')
    expect(readKnowledge('KnowledgeSourceCards.tsx')).toContain('graphJobStatusBySource')
    expect(page).toContain("t('knowledge.organize_phase_graph_nodes', '节点向量')")
    expect(page).toContain('parseKnowledgeGraphStepError')
    expect(page).toContain('organizePhaseList')
    expect(page).toContain('queuedSourceIds')
    expect(page).not.toContain('knowledge.job_vector_active')
    expect(css).toMatch(/\.sourceCardItem \{[^}]*min-height: 220px/)
    expect(page).not.toContain('styles.addSourceBtn')
    expect(page).not.toContain('ingestProgressPercent')
    expect(page).not.toContain('engine_caps')
    expect(page).not.toContain('renderCapRow')
    expect(page).toContain('settingsRowHint')
    expect(page).toContain('knowledgeExtractSettingsVisibility')
    expect(page).toContain('showOcrSettings')
    expect(page).toContain('showVisionSettings')
    expect(page).toContain('vision_model_recommend')
    expect(page).toContain('KnowledgeExtractProbeSection')
    expect(readKnowledge('KnowledgeExtractProbeSection.tsx')).toContain(
      "t('knowledge.extract_probe'"
    )
    expect(css).toContain('.settingsProbeBody')
    expect(page).toContain('normalizeKnowledgeDefaultExtractEngine')
    expect(page).not.toContain("value: 'simple'")
    expect(page).not.toContain('extract_hint_keep')
    const hint = readKnowledge('KnowledgeExtractHintDialog.tsx')
    expect(hint).not.toContain('extract_hint_keep')
    expect(hint).not.toContain('showKeepTextLayer')
    expect(hint).toContain("import { Button } from '@baishou/ui'")
    expect(hint).not.toContain('dialogCancelBtn')
    expect(readKnowledge('KnowledgeHeavyConfirmDialog.tsx')).toContain(
      "import { Button } from '@baishou/ui'"
    )
    expect(readKnowledge('KnowledgeImportProcessDialog.tsx')).toContain(
      "import { Button, Select } from '@baishou/ui'"
    )
    expect(readKnowledge('KnowledgeImportProcessDialog.tsx')).toContain('import_process_hint_later')
    expect(page).toContain('knowledgeSourceShowsPendingOrganizeHelp')
    expect(page).toContain("t('knowledge.status_stored', '待整理')")
    expect(page).toContain('knowledge.status_stored_help')
    expect(page).toContain("t('knowledge.import_stored', '已保存为待整理')")
    expect(page).toContain('knowledge.delete_source_confirm')
    expect(page).toContain('图关系和向量数据')
    expect(css).toContain('.sourceCardStatus')
    expect(css).toContain('.sourceCardFailWrap')
    expect(css).toContain('.sourceFailTooltip')
    expect(css).toMatch(/\.sourcesStage \{[^}]*flex-direction: column/)
    expect(css).toMatch(/\.sourcesStage \{[^}]*min-height: 0/)
    expect(css).toMatch(/\.sourcesBody \{[^}]*flex: 1/)
    expect(css).toMatch(/\.sourceGrid \{/)
    expect(css).not.toContain('.sourcesToolbar')
    expect(css).not.toContain('.addSourceBtn')
    expect(page).toContain('Promise.all')
    expect(page).not.toContain("await callKnowledgeApi('recoverStale'")
    expect(page).toContain("void callKnowledgeApi('recoverStale'")
    expect(page).toContain('hasModelMismatch')
    expect(page).toContain('knowledge-model-mismatch')
    expect(page).toContain('model_mismatch_hard_block')
    expect(page).toContain('actions.onRebuild')
  })

  it('should reuse the memory-graph sidebar panel scrollbar for notebook graph', () => {
    const pane = readNotebookGraphChrome()
    expect(pane).toContain('graphStyles.side')
    expect(pane).toContain('graphStyles.panel')
    expect(pane).toContain('data-graph-side-scroll')
    const css = readFileSync(join(knowledgeDir, '..', 'graph', 'GraphPage.module.css'), 'utf8')
    expect(css).toMatch(/\.panel \{[^}]*min-height: 0/)
    expect(css).toMatch(/\.panel \{[^}]*overflow-y: auto/)
  })

  it('should hint pending reviews on the notebook content rail', () => {
    const pane = readNotebookGraphChrome()
    expect(pane).toContain('formatGraphRailCount')
    expect(pane).toContain('graphStyles.railCount')
    expect(pane).toContain("t('graph.side_content_pending'")
  })

  it('should keep notebook graph side rails and content tabs in memory-graph order', () => {
    const pane = readNotebookGraphChrome()
    const page = readKnowledgeDetailChrome()
    expect(pane.indexOf("onOpenSide('ops')")).toBeLessThan(pane.indexOf("onOpenSide('settings')"))
    expect(pane.indexOf("onOpenSide('settings')")).toBeLessThan(pane.indexOf("onOpenSide('content')"))
    expect(pane.indexOf("t('graph.tab_reextract'")).toBeLessThan(
      pane.indexOf("t('graph.tab_pending_count'")
    )
    expect(pane.indexOf("t('graph.tab_pending_count'")).toBeLessThan(
      pane.indexOf("t('graph.tab_similar_count'")
    )
    expect(pane.indexOf("t('graph.tab_similar_count'")).toBeLessThan(
      pane.indexOf("t('graph.tab_detail'")
    )
    expect(pane).not.toContain("t('knowledge.graph_tab_queue'")
    expect(pane).toContain("useState<NotebookGraphSideMode>('ops')")
    expect(pane).toContain("useState<NotebookGraphSideTab>('reextract')")
    expect(pane).toContain("t('graph.queue_view_progress'")
    expect(pane).toContain('onOpenQueue')
    expect(pane).not.toContain("setTab('queue')")
    expect(pane).not.toContain('styles.graphProgress')
    expect(page).not.toContain("activeTab !== 'graph'")
    expect(page).toContain('onOpenChange={setOrganizeOpen}')
  })

  it('should reuse memory-graph merge search and similar pane for notebook graph ops', () => {
    const pane = readNotebookGraphChrome()
    expect(pane).toContain('GraphPageSimilarPane')
    expect(pane).toContain("tab === 'similar'")
    expect(pane).toContain("t('graph.merge_nodes'")
    expect(pane).toContain('listGraphSimilarPairs')
    expect(pane).toContain('mergeGraphNodes')
    expect(pane).toContain('forbiddenAnchorTypes={[' + "'source'" + ']}')
    expect(pane).toContain("searchNodes={props.searchMergeNodes}")
  })

  it('should render notebook graph inspector values with chrome classes', () => {
    const pane = readNotebookGraphChrome()
    expect(pane).toContain('graphStyles.detailValue')
    expect(pane).toContain('graphStyles.detailLabel')
    expect(pane).not.toContain('graphStyles.itemTitle}>{selectedNode.name}')
  })

  it('should keep a visible scrollbar on graph node fragment preview', () => {
    const page = readKnowledgeDetailChrome()
    const css = readKnowledge('KnowledgePage.module.css')
    expect(page).toContain('fragment_preview_title')
    expect(page).toContain('styles.fragmentList')
    expect(css).toMatch(/\.fragmentList \{[^}]*overflow-y: scroll/)
    expect(css).toMatch(/\.fragmentList \{[^}]*scrollbar-gutter: stable/)
    expect(css).toContain('.fragmentList::-webkit-scrollbar')
  })

  it('should list organizing sources and expand one source phases in the modal', () => {
    const banner = readKnowledge('KnowledgeDetailJobBanner.tsx')
    const css = readKnowledge('KnowledgePage.module.css')
    const page = readKnowledgeDetailChrome()
    expect(page).toContain('sourceRows')
    expect(page).toContain('graphJobsBySource')
    expect(banner).toContain('organizeSourceList')
    expect(banner).toContain('knowledgeOrganizeDefaultSourceId')
    expect(banner).toContain('setOpenSourceId')
    expect(banner).toContain('knowledgeOrganizeSourceSummary')
    expect(banner).toContain("t('knowledge.organize_count'")
    expect(banner).toContain('organizeSourcePhases')
    expect(banner.indexOf('</button>')).toBeLessThan(banner.indexOf('organizeSourcePhases'))
    expect(css).toContain('.organizeSourceList')
    expect(css).toContain('.organizeSourceRow')
    expect(css).toContain('.organizeSourcePhases')
    expect(css).toMatch(
      /\.organizeSourcePhases \{[^}]*padding: var\(--spacing-sm\) var\(--spacing-md\) var\(--spacing-md\)/
    )
    expect(css).toMatch(/\.organizeSourceList \{[^}]*list-style: none/)
    expect(css).toMatch(/\.organizeSourceItem \{[^}]*var\(--radius-md\)/)
  })

  it('should start unified organize from the empty graph guide and keep rebuild as maintenance', () => {
    const page = readKnowledgeDetailChrome()
    const pane = readNotebookGraphChrome()
    expect(page).toContain('organizeNotebook')
    expect(page).not.toContain('triggerBatchEmbed')
    expect(page).toContain('onRebuildGraph={() => {')
    expect(pane).toContain('onRebuildGraph ?? onStartExtract')
  })

  it('should delete the open notebook after a three-second confirm dialog', () => {
    const page = readKnowledgeDetailChrome()
    const dialog = readKnowledge('KnowledgeDeleteNotebookDialog.tsx')
    expect(page).toContain('KnowledgeDeleteNotebookDialog')
    expect(page).toContain('window.api.knowledge.deleteNotebook')
    expect(page).toContain("t('knowledge.delete_notebook'")
    expect(dialog).toContain('isNotebookHeavyConfirmReady')
    expect(dialog).toContain('notebookHeavyConfirmSecondsLeft')
  })
})
