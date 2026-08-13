import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { WorkspaceChangeEntry } from '@baishou/shared'
import {
  FileChangeDiff,
  FileChangeMergeDiff,
  resolveFileChangeDocuments,
  type FileChangeMergeViewMode
} from '@baishou/ui'
import styles from './WorkbenchFileChangeDiffPane.module.css'

export interface WorkbenchFileChangeDiffPaneProps {
  folderRoot: string | null
  change: WorkspaceChangeEntry
  /** When set with folderRoot, modified edits are persisted like other workbench tabs. */
  onModifiedChange?: (content: string) => void
}

type LoadState =
  | { status: 'loading' }
  | {
      status: 'ready'
      original: string
      modified: string
      fallback: boolean
    }

export const WorkbenchFileChangeDiffPane: React.FC<WorkbenchFileChangeDiffPaneProps> = ({
  folderRoot,
  change,
  onModifiedChange
}) => {
  const { t } = useTranslation()
  const [viewMode, setViewMode] = useState<FileChangeMergeViewMode>('inline')
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoadState({ status: 'loading' })

      let diskAvailable = false
      let diskContent: string | null | undefined

      if (change.kind === 'delete') {
        // Deleted files should compare against empty modified, even if the path exists again.
        diskAvailable = true
        diskContent = null
      } else if (folderRoot && change.path) {
        try {
          const result = await window.api.agentWorkspace.readFile(folderRoot, change.path)
          if (cancelled) return
          diskAvailable = true
          diskContent = result.content
        } catch {
          if (cancelled) return
          diskAvailable = true
          diskContent = null
        }
      }

      const resolved = resolveFileChangeDocuments({
        diff: change.data.diff,
        diskAvailable,
        diskContent
      })

      if (cancelled) return

      if (resolved.mode === 'merge') {
        setLoadState({
          status: 'ready',
          original: resolved.original,
          modified: resolved.modified,
          fallback: false
        })
      } else {
        setLoadState({
          status: 'ready',
          original: '',
          modified: '',
          fallback: true
        })
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [folderRoot, change.id, change.path, change.kind, change.data.diff])

  const canEditModified =
    Boolean(folderRoot) && Boolean(onModifiedChange) && loadState.status === 'ready' && !loadState.fallback

  const handleModifiedChange = useCallback(
    (content: string) => {
      setLoadState((prev) =>
        prev.status === 'ready' && !prev.fallback ? { ...prev, modified: content } : prev
      )
      onModifiedChange?.(content)
    },
    [onModifiedChange]
  )

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.path}>{change.path}</span>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.modeBtn} ${viewMode === 'inline' ? styles.modeBtnActive : ''}`}
            onClick={() => setViewMode('inline')}
            disabled={loadState.status !== 'ready' || loadState.fallback}
          >
            {t('workbench.diff_mode_inline', 'Inline')}
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${viewMode === 'side-by-side' ? styles.modeBtnActive : ''}`}
            onClick={() => setViewMode('side-by-side')}
            disabled={loadState.status !== 'ready' || loadState.fallback}
          >
            {t('workbench.diff_mode_side_by_side', '并排')}
          </button>
        </div>
      </div>
      <div className={styles.body}>
        {loadState.status === 'loading' ? (
          <p className={styles.status}>{t('workbench.loading_diff', '正在加载 diff…')}</p>
        ) : !loadState.fallback ? (
          <FileChangeMergeDiff
            path={change.path}
            original={loadState.original}
            modified={loadState.modified}
            viewMode={viewMode}
            modifiedEditable={canEditModified}
            onModifiedChange={canEditModified ? handleModifiedChange : undefined}
          />
        ) : (
          <FileChangeDiff data={change.data} className={styles.fallbackDiff} />
        )}
      </div>
    </div>
  )
}
