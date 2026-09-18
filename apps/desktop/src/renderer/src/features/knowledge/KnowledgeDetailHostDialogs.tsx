import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AnchoredContextMenu, Button, type ContextMenuItem } from '@baishou/ui'
import { resolveReasoningEffortForSlot, type ReasoningEffortSetting } from '@baishou/shared'
import { KnowledgeDialog } from './KnowledgeDialog'
import { KnowledgeHeavyConfirmDialog } from './KnowledgeHeavyConfirmDialog'
import type { KnowledgeHeavyConfirmKind } from './KnowledgeHeavyConfirmDialog'
import { KnowledgeModelMenu } from './KnowledgeModelMenu'
import type { KnowledgeMenuProvider } from './notebook-model-menu.util'
import {
  KnowledgeSourcePreviewDialog,
  type SourcePreviewPayload
} from './KnowledgeSourcePreviewDialog'
import { KnowledgeSourceFragmentDialog } from './KnowledgeSourceFragmentDialog'
import {
  NotebookDataManageDialog,
  type NotebookDataManageConfirm
} from './NotebookDataManageDialog'
import type { KnowledgeSourceFragment } from './knowledge-source-fragment.util'
import type { KnowledgeSourceRow } from './knowledge-detail.types'
import type { NotebookModelPicker } from './useNotebookStatusModels'
import { SETTINGS_HUB_PREFIX } from '../settings/settings-route.util'
import styles from './KnowledgePage.module.css'

export function KnowledgeDetailHostDialogs(props: {
  busy: boolean
  dataManageOpen: boolean
  onCloseDataManage: () => void
  onManageNotebookData: (input: NotebookDataManageConfirm) => void
  deleteTarget: KnowledgeSourceRow | null
  onCloseDelete: () => void
  onDeleteSource: (sourceId: string) => void
  heavyConfirmKind: KnowledgeHeavyConfirmKind | null
  heavyConfirmSource: KnowledgeSourceRow | null
  onCancelHeavy: () => void
  onConfirmHeavy: () => void
  sourceMenu: { sourceId: string; x: number; y: number } | null
  sourceMenuItems: ContextMenuItem[]
  onCloseSourceMenu: () => void
  picker: NotebookModelPicker | null
  providers: KnowledgeMenuProvider[]
  globalEmbeddingProviderId?: string
  globalEmbeddingModelId?: string
  globalGraphProviderId?: string
  globalGraphModelId?: string
  visionProviderId: string | null
  visionModelId: string | null
  reasoningEffortBySlot?: Parameters<typeof resolveReasoningEffortForSlot>[0]
  onSelectModel: (providerId: string, modelId: string) => void
  persistReasoningSlot: (slot: 'graph' | 'vision', value: ReasoningEffortSetting) => void
  closePicker: () => void
  closeSettings: () => void
  previewOpen: boolean
  previewTitle: string
  previewLoading: boolean
  previewError: string | null
  previewPayload: SourcePreviewPayload | null
  onClosePreview: () => void
  fragmentOpen: boolean
  fragmentLoading: boolean
  fragmentError: string | null
  fragments: KnowledgeSourceFragment[]
  onCloseFragments: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <>
      <NotebookDataManageDialog
        open={props.dataManageOpen}
        busy={props.busy}
        onClose={props.onCloseDataManage}
        onConfirm={props.onManageNotebookData}
      />

      {props.sourceMenu ? (
        <AnchoredContextMenu
          x={props.sourceMenu.x}
          y={props.sourceMenu.y}
          items={props.sourceMenuItems}
          onClose={props.onCloseSourceMenu}
        />
      ) : null}

      <KnowledgeDialog
        open={props.deleteTarget != null}
        onClose={props.onCloseDelete}
        closeDisabled={props.busy}
        title={t('knowledge.delete_source_title', '删除资料')}
        aria-label={t('knowledge.delete_source_title', '删除资料')}
      >
        <p className={styles.guideHint}>
          {t(
            'knowledge.delete_source_confirm',
            '将删除「{{title}}」的原文和提取结果，并清空这份资料对应的图关系和向量数据。此操作不能恢复。',
            { title: props.deleteTarget?.title || '' }
          )}
        </p>
        <div className={styles.extractHintActions}>
          <Button type="button" disabled={props.busy} onClick={props.onCloseDelete}>
            {t('common.cancel', '取消')}
          </Button>
          <Button
            type="button"
            disabled={props.busy || !props.deleteTarget}
            onClick={() => {
              if (props.deleteTarget) void props.onDeleteSource(props.deleteTarget.id)
            }}
          >
            {t('knowledge.delete_source', '删除')}
          </Button>
        </div>
      </KnowledgeDialog>

      <KnowledgeHeavyConfirmDialog
        open={props.heavyConfirmKind != null}
        kind={props.heavyConfirmKind}
        sourceTitle={props.heavyConfirmSource?.title}
        onCancel={props.onCancelHeavy}
        onConfirm={props.onConfirmHeavy}
      />

      {props.picker ? (
        <KnowledgeModelMenu
          kind={props.picker.kind}
          providers={props.providers}
          currentProviderId={
            props.picker.field === 'embedding'
              ? props.globalEmbeddingProviderId
              : props.picker.field === 'graph'
                ? props.globalGraphProviderId
                : (props.visionProviderId ?? undefined)
          }
          currentModelId={
            props.picker.field === 'embedding'
              ? props.globalEmbeddingModelId
              : props.picker.field === 'graph'
                ? props.globalGraphModelId
                : (props.visionModelId ?? undefined)
          }
          anchorRect={props.picker.anchor}
          onSelect={(providerId, modelId) => {
            void props.onSelectModel(providerId, modelId)
          }}
          onClose={props.closePicker}
          reasoningEffort={
            props.picker.field === 'graph'
              ? resolveReasoningEffortForSlot(props.reasoningEffortBySlot, 'graph')
              : props.picker.field === 'vision'
                ? resolveReasoningEffortForSlot(props.reasoningEffortBySlot, 'vision')
                : 'auto'
          }
          onReasoningEffortChange={(value) => {
            if (props.picker?.field === 'graph') void props.persistReasoningSlot('graph', value)
            if (props.picker?.field === 'vision') void props.persistReasoningSlot('vision', value)
          }}
          onManageProviders={() => {
            props.closeSettings()
            navigate(`${SETTINGS_HUB_PREFIX}/ai-services`)
          }}
        />
      ) : null}

      <KnowledgeSourcePreviewDialog
        open={props.previewOpen}
        onClose={props.onClosePreview}
        title={
          props.previewTitle
            ? `${t('knowledge.preview_source_title', '源文件预览')} · ${props.previewTitle}`
            : t('knowledge.preview_source_title', '源文件预览')
        }
        loading={props.previewLoading}
        error={props.previewError}
        payload={props.previewPayload}
      />
      <KnowledgeSourceFragmentDialog
        open={props.fragmentOpen}
        loading={props.fragmentLoading}
        error={props.fragmentError}
        fragments={props.fragments}
        onClose={props.onCloseFragments}
      />
    </>
  )
}
