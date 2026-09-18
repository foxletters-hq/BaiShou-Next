import React from 'react'
import { useTranslation } from 'react-i18next'
import { GitDiffViewer, type WorkbenchSelectionAffordanceState } from '@baishou/ui'
import { WorkbenchLivePreviewEditor } from './WorkbenchLivePreviewEditor'
import { WorkbenchGitEditableDiff } from './WorkbenchGitEditableDiff'
import { WorkbenchFileChangeDiffPane } from './WorkbenchFileChangeDiffPane'
import type { WorkbenchTab } from './useWorkbenchTabs'
import type { WorkbenchEditorSelectionHandle } from './workbench-editor-selection.util'
import { isMissingWorkbenchFileError } from './workbench-tab-close.util'
import workbenchMascot from './assets/workbench-mascot.png'
import styles from './WorkbenchMainPane.module.css'

export interface WorkbenchEditorContentProps {
  folderRoot: string
  activeTab: WorkbenchTab | undefined
  idleCaption: string
  markdownEditorRef: React.Ref<WorkbenchEditorSelectionHandle>
  gitDiffEditorRef: React.Ref<WorkbenchEditorSelectionHandle>
  mergeDiffEditorRef: React.Ref<WorkbenchEditorSelectionHandle>
  onContentChange: (tabId: string, content: string, relativePath: string) => void
  onScrolledToLine: (tabId: string) => void
  onSelectionAffordanceChange: (next: WorkbenchSelectionAffordanceState | null) => void
}

export const WorkbenchEditorContent: React.FC<WorkbenchEditorContentProps> = ({
  folderRoot,
  activeTab,
  idleCaption,
  markdownEditorRef,
  gitDiffEditorRef,
  mergeDiffEditorRef,
  onContentChange,
  onScrolledToLine,
  onSelectionAffordanceChange
}) => {
  const { t } = useTranslation()

  if (!activeTab) {
    return (
      <div className={styles.idleHero}>
        <img src={workbenchMascot} alt="" className={styles.idleMascot} draggable={false} />
        <p className={styles.idleCaption}>{idleCaption}</p>
      </div>
    )
  }

  if (activeTab.loading) {
    return <p className={styles.status}>{t('workbench.loading_file', '正在加载文件…')}</p>
  }

  if (activeTab.error) {
    return (
      <p className={styles.missingFile}>
        {isMissingWorkbenchFileError(activeTab.error)
          ? t('workbench.file_not_found', '文件不存在')
          : t('workbench.load_file_failed', '无法加载文件')}
      </p>
    )
  }

  if (activeTab.kind === 'git-diff' && activeTab.loading) {
    return <p className={styles.status}>{t('workbench.loading_diff', '正在加载 diff…')}</p>
  }

  if (activeTab.kind === 'git-diff' && activeTab.gitDiffEditable && activeTab.relativePath) {
    return (
      <div className={styles.diffWrap}>
        <div className={styles.diffHeader}>
          {activeTab.relativePath}
          {activeTab.gitDiffStaged
            ? ` (${t('version_control.staged', '已暂存')})`
            : ` (${t('workbench.git_working_copy', '工作区')})`}
        </div>
        <div className={styles.diffBody}>
          <WorkbenchGitEditableDiff
            ref={gitDiffEditorRef}
            originalContent={activeTab.gitDiffOriginal ?? ''}
            content={activeTab.content ?? ''}
            onChange={(content) => {
              onContentChange(activeTab.id, content, activeTab.relativePath!)
            }}
            onSelectionAffordanceChange={onSelectionAffordanceChange}
          />
        </div>
      </div>
    )
  }

  if (activeTab.kind === 'git-diff' && activeTab.gitDiffReadOnly && activeTab.relativePath) {
    return (
      <div className={styles.diffWrap}>
        <div className={styles.diffHeader}>
          {activeTab.relativePath}
          {activeTab.gitDiffCommitHash ? ` @ ${activeTab.gitDiffCommitHash.slice(0, 7)}` : ''}
        </div>
        <div className={styles.diffBody}>
          <WorkbenchGitEditableDiff
            ref={gitDiffEditorRef}
            originalContent={activeTab.gitDiffOriginal ?? ''}
            content={activeTab.content ?? ''}
            readOnly
            onSelectionAffordanceChange={onSelectionAffordanceChange}
          />
        </div>
      </div>
    )
  }

  if (activeTab.kind === 'git-diff' && activeTab.fileDiff) {
    return (
      <div className={styles.diffWrap}>
        <div className={styles.diffHeader}>
          {activeTab.relativePath}
          {activeTab.gitDiffCommitHash
            ? ` @ ${activeTab.gitDiffCommitHash.slice(0, 7)}`
            : activeTab.gitDiffStaged
              ? ` (${t('version_control.staged', '已暂存')})`
              : ''}
        </div>
        <div className={styles.diffBody}>
          <GitDiffViewer diff={activeTab.fileDiff} defaultMode="split" showModeToggle fillHeight />
        </div>
      </div>
    )
  }

  if (activeTab.kind === 'diff' && activeTab.change) {
    return (
      <WorkbenchFileChangeDiffPane
        ref={mergeDiffEditorRef}
        folderRoot={folderRoot}
        change={activeTab.change}
        onModifiedChange={
          activeTab.change.path
            ? (content) => {
                onContentChange(activeTab.id, content, activeTab.change!.path)
              }
            : undefined
        }
        onSelectionAffordanceChange={onSelectionAffordanceChange}
      />
    )
  }

  if (activeTab.kind === 'markdown' && activeTab.relativePath) {
    return (
      <WorkbenchLivePreviewEditor
        ref={markdownEditorRef}
        documentId={activeTab.id}
        content={activeTab.content ?? ''}
        folderRoot={folderRoot}
        relativePath={activeTab.relativePath}
        scrollToLine={activeTab.scrollToLine}
        scrollToColumn={activeTab.scrollToColumn}
        onScrolledToLine={() => onScrolledToLine(activeTab.id)}
        onChange={(content) => {
          onContentChange(activeTab.id, content, activeTab.relativePath!)
        }}
        onSelectionAffordanceChange={onSelectionAffordanceChange}
      />
    )
  }

  return (
    <div className={styles.textPreview}>
      <p className={styles.previewHint}>
        {t('workbench.preview_unsupported', '此文件类型暂不支持编辑，仅显示预览。')}
      </p>
      <pre>{activeTab.content}</pre>
    </div>
  )
}
