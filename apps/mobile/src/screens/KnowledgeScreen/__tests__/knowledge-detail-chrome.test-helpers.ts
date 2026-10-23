import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const dir = dirname(fileURLToPath(import.meta.url))

/** 读取 KnowledgeScreen 目录下的源码，供源码级回归断言使用 */
export function readKnowledgeSrc(name: string): string {
  return readFileSync(join(dir, '..', name), 'utf8')
}

/** 读取 mobile services 目录下的源码 */
export function readServiceSrc(name: string): string {
  return readFileSync(join(dir, '../../../services', name), 'utf8')
}

/** 笔记详情页同一职责的源码按顺序拼接 */
export const page = [
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
  .map(readKnowledgeSrc)
  .join('\n')

/** 图谱复核服务拆分后的源码按顺序拼接，便于继续做源码级回归断言 */
export const graphReviewService = [
  'mobile-notebook-graph-review.ts',
  'mobile-notebook-graph-review.runtime.ts',
  'mobile-notebook-graph-review.writes.ts'
]
  .map(readServiceSrc)
  .join('\n')
