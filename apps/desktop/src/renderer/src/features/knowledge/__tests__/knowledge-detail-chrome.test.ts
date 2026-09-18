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
    'NotebookGraphSidePanel.tsx'
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
    expect(page).toContain('styles.jobProgress')
    expect(page).toContain('pickSourceCardEvidence')
    expect(page).toContain('sourceCardFailureReason')
    expect(page).toContain('knowledgeIngestUserMessage')
    expect(readKnowledge('knowledge-ingest-user-error.util.ts')).toContain('source_not_embedded')
    expect(page).toContain('<Tooltip')
    expect(page).not.toContain("evidence?.type === 'error'")
    expect(page).toContain('notebookJobProgressCopy')
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
  })

  it('should render notebook graph inspector values with chrome classes', () => {
    const pane = readNotebookGraphChrome()
    expect(pane).toContain('graphStyles.detailValue')
    expect(pane).toContain('graphStyles.detailLabel')
    expect(pane).not.toContain('graphStyles.itemTitle}>{selectedNode.name}')
  })

  it('should start unified organize from the empty graph guide and keep rebuild as maintenance', () => {
    const page = readKnowledgeDetailChrome()
    const pane = readNotebookGraphChrome()
    expect(page).toContain('triggerBatchEmbed')
    expect(page).toContain('onRebuildGraph={() => {')
    expect(pane).toContain('onRebuildGraph ?? onStartExtract')
  })
})
