import { parseKnowledgeGraphStepError } from '@baishou/shared'
import {
  knowledgeOrganizeCompactKind,
  type KnowledgeOrganizeProgressCopy
} from './notebook-job-progress.util'

type OrganizeTranslate = (key: string, fallback: string, options?: Record<string, number>) => string

export type KnowledgeOrganizeCompactStatus = {
  label: string
  running: boolean
  failed: boolean
}

/** 从整理进度中提炼状态卡的标题，和整理弹窗保持同一套文案。 */
export function knowledgeOrganizeCompactStatus(
  t: OrganizeTranslate,
  progress: KnowledgeOrganizeProgressCopy
): KnowledgeOrganizeCompactStatus {
  const failedStep = parseKnowledgeGraphStepError(progress.error)?.step ?? null
  const compactKind = knowledgeOrganizeCompactKind(progress.phases, progress.failed)
  const label = progress.failed
    ? failedStep === 'node-embed'
      ? t('knowledge.organize_failed_graph_nodes', '节点向量失败')
      : failedStep === 'align'
        ? t('knowledge.organize_failed_graph_align', '图谱对齐失败')
        : failedStep === 'extract'
          ? t('knowledge.organize_failed_graph_extract', '图谱抽取失败')
          : t('knowledge.organize_failed', '抽取失败')
    : progress.paused
      ? t('knowledge.organize_incomplete', '整理未完成')
      : progress.sourceRows.length > 1
        ? t('knowledge.organize_count', '正在整理 {{count}} 份资料', {
            count: progress.sourceRows.length
          })
        : compactKind === 'graph'
          ? t('knowledge.status_graph_organizing', '正在整理图谱')
          : compactKind === 'graphNodes'
            ? t('knowledge.organize_phase_graph_nodes_running', '正在整理节点向量')
            : compactKind === 'embed'
              ? t('knowledge.status_embedding', '正在建立索引')
              : compactKind === 'extract'
                ? t('knowledge.status_extracting', '正在提取文本')
                : t('knowledge.organize_title', '正在整理')

  return {
    label,
    running: !progress.failed && !progress.paused,
    failed: progress.failed
  }
}
