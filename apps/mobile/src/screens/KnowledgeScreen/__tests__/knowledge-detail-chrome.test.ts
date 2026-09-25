import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const page = [
  'KnowledgeDetailScreen.tsx',
  'useKnowledgeDetail.ts',
  'KnowledgeDetailCoverSection.tsx',
  'KnowledgeDetailImportSection.tsx',
  'KnowledgeDetailSourcesSection.tsx',
  'KnowledgeDetailManageSection.tsx',
  'KnowledgeDetailExtractSection.tsx',
  'KnowledgeNotebookGraphSection.tsx',
  'KnowledgeDetailVectorsSection.tsx',
  'KnowledgeNotebookDeleteDialog.tsx'
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
    expect(page).toContain('HelpTooltip')
    expect(page).toContain('knowledge.status_stored_help')
    expect(page).toContain('<Tooltip content={s.errorMessage.trim()}')
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
    expect(page).toContain("t('knowledge.rebuild_graph'")
    expect(page).toContain("t('graph.start_organize'")
    expect(page).toContain('onStartOrganize')
    expect(page).toContain('knowledgeSourceCanRetry')
    expect(page).toContain('knowledgeSourceCanReembedGraph')
    expect(page).toContain('manageVector')
    expect(page).toContain('manageGraph')
    expect(page).toContain('pendingEdges')
    expect(page).toContain('similarPairs')
    expect(page).toContain('GraphForceWebView')
    expect(page).toContain('mobileCancelExtract')
    expect(page).toContain('mobileRecoverStaleIngest')
    expect(page).toContain('mobileEmbedSource')
    expect(page).toContain('mobileGetExtractedPreview')
    expect(page).toContain('mobileSetKnowledgeConfig')
    expect(page).toContain('mobileListKnowledgeChunks')
  })

  it('should use settings sections and require a three-second delete countdown', () => {
    expect(page).toContain('SettingsSection')
    expect(page).toContain("from '@baishou/ui/native'")
    expect(page).toContain('KnowledgeNotebookDeleteDialog')
    expect(page).toContain('mobileDeleteNotebook')
    expect(page).toContain('isNotebookHeavyConfirmReady')
    expect(page).toContain('notebookHeavyConfirmSecondsLeft')
    expect(page).toContain('knowledge.delete_notebook')
    expect(page).not.toContain('#fff')
    expect(page).not.toContain('#666')
  })
})
