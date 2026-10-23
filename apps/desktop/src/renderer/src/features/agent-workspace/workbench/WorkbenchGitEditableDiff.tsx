import React, { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FileChangeMergeDiff,
  type FileChangeMergeSelectionHandle,
  type WorkbenchSelectionAffordanceState
} from '@baishou/ui'
import type { WorkbenchEditorSelectionHandle } from './workbench-editor-selection.util'
import styles from './WorkbenchGitEditableDiff.module.css'

export interface WorkbenchGitEditableDiffProps {
  path: string
  originalContent: string
  content: string
  onChange?: (content: string) => void
  readOnly?: boolean
  onSelectionAffordanceChange?: (state: WorkbenchSelectionAffordanceState | null) => void
}

export const WorkbenchGitEditableDiff = forwardRef<
  WorkbenchEditorSelectionHandle,
  WorkbenchGitEditableDiffProps
>(function WorkbenchGitEditableDiff(
  { path, originalContent, content, onChange, readOnly = false, onSelectionAffordanceChange },
  ref
) {
  const { t } = useTranslation()

  return (
    <div className={styles.root}>
      <div className={styles.mergeHost}>
        <FileChangeMergeDiff
          ref={ref as React.Ref<FileChangeMergeSelectionHandle>}
          path={path}
          original={originalContent}
          modified={content}
          viewMode="inline"
          modifiedEditable={!readOnly}
          onModifiedChange={readOnly ? undefined : onChange}
          onSelectionAffordanceChange={onSelectionAffordanceChange}
        />
      </div>
      {readOnly ? (
        <div className={styles.hint}>
          {t('workbench.git_diff_readonly_hint', '历史版本只读，不会改写工作区文件')}
        </div>
      ) : (
        <div className={styles.hint}>
          {t('workbench.git_diff_editable_hint', '可直接编辑，保存后自动写入工作区文件')}
        </div>
      )}
    </div>
  )
})
