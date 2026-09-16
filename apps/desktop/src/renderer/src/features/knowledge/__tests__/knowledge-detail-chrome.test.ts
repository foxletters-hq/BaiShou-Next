import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const knowledgeDir = join(here, '..')

function readKnowledge(fileName: string): string {
  return readFileSync(join(knowledgeDir, fileName), 'utf8')
}

describe('knowledge detail chrome', () => {
  it('should keep model status in the sources page instead of an open dialog', () => {
    const page = readKnowledge('KnowledgeDetailPage.tsx')
    const css = readKnowledge('KnowledgePage.module.css')

    const panel = readKnowledge('NotebookStatusPanel.tsx')
    const panelCss = readKnowledge('NotebookStatusPanel.module.css')

    expect(page).toContain('<NotebookStatusPanel')
    expect(page).toContain('onPickRow={pickStatusRow}')
    expect(page).toContain('resolveGlobalGraphModelIds')
    expect(page).toContain('graphModelId: extract.modelId')
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
    expect(page).toContain('normalizeKnowledgeDefaultExtractEngine')
    expect(page).not.toContain("value: 'simple'")
    expect(page).not.toContain('extract_hint_keep')
    const hint = readKnowledge('KnowledgeExtractHintDialog.tsx')
    expect(hint).not.toContain('extract_hint_keep')
    expect(hint).not.toContain('showKeepTextLayer')
    expect(hint).toContain('import { Button } from \'@baishou/ui\'')
    expect(hint).not.toContain('dialogCancelBtn')
    expect(readKnowledge('KnowledgeHeavyConfirmDialog.tsx')).toContain(
      'import { Button } from \'@baishou/ui\''
    )
    expect(readKnowledge('KnowledgeImportProcessDialog.tsx')).toContain(
      'import { Button, Select } from \'@baishou/ui\''
    )
    expect(css).toMatch(/\.sourcesStage \{[^}]*flex-direction: column/)
    expect(css).toMatch(/\.sourcesStage \{[^}]*min-height: 0/)
    expect(css).toMatch(/\.sourcesBody \{[^}]*flex: 1/)
    expect(css).toMatch(/\.sourceGrid \{/)
    expect(css).not.toContain('.sourcesToolbar')
    expect(css).not.toContain('.addSourceBtn')
  })

  it('should render notebook graph inspector values with chrome classes', () => {
    const pane = readKnowledge('NotebookGraphPane.tsx')
    expect(pane).toContain('graphStyles.detailValue')
    expect(pane).toContain('graphStyles.detailLabel')
    expect(pane).not.toContain('graphStyles.itemTitle}>{selectedNode.name}')
  })
})
