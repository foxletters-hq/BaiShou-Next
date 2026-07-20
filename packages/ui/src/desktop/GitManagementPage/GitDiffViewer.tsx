import React, { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FileDiff } from '@baishou/shared'
import { fileDiffToSplitRows } from './git-diff.utils'
import styles from './GitDiffViewer.module.css'

export type GitDiffViewMode = 'unified' | 'split'

export interface GitDiffViewerProps {
  diff: FileDiff
  /** 主编辑区默认 split，侧栏默认 unified */
  defaultMode?: GitDiffViewMode
  showModeToggle?: boolean
  fillHeight?: boolean
  className?: string
}

const UnifiedDiffBody: React.FC<{ diff: FileDiff; fillHeight?: boolean }> = ({
  diff,
  fillHeight
}) => {
  const { t } = useTranslation()

  if (diff.hunks.length === 0) {
    return <div className={styles.empty}>{t('version_control.no_diff', 'No diff')}</div>
  }

  return (
    <pre className={styles.unifiedContent}>
      {diff.hunks.map((hunk, i) => (
        <div key={i}>
          <div className={styles.hunkHeader}>
            @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
          </div>
          {hunk.content.split('\n').map((line, j) => {
            if (!line && j === hunk.content.split('\n').length - 1) return null
            const cls = line.startsWith('+')
              ? styles.lineAdd
              : line.startsWith('-')
                ? styles.lineRemove
                : styles.lineNormal
            return (
              <div key={j} className={cls}>
                {line}
              </div>
            )
          })}
        </div>
      ))}
    </pre>
  )
}

const SplitDiffBody: React.FC<{ diff: FileDiff }> = ({ diff }) => {
  const { t } = useTranslation()
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const syncing = useRef(false)

  const rows = fileDiffToSplitRows(diff)

  const syncScroll = useCallback((source: HTMLDivElement, target: HTMLDivElement | null) => {
    if (!target || syncing.current) return
    syncing.current = true
    target.scrollTop = source.scrollTop
    requestAnimationFrame(() => {
      syncing.current = false
    })
  }, [])

  if (rows.length === 0) {
    return <div className={styles.empty}>{t('version_control.no_diff', 'No diff')}</div>
  }

  return (
    <div className={styles.splitRoot}>
      <div className={styles.splitHeader}>
        <div className={styles.splitHeaderCell}>{t('workbench.diff_original', '原始')}</div>
        <div className={styles.splitHeaderCell}>{t('workbench.diff_modified', '修改后')}</div>
      </div>
      <div className={styles.splitBody}>
        <div
          ref={leftRef}
          className={styles.splitPane}
          onScroll={(event) => syncScroll(event.currentTarget, rightRef.current)}
        >
          {rows.map((row, index) => (
            <div
              key={`l-${index}`}
              className={`${styles.splitRow} ${
                row.kind === 'remove'
                  ? styles.rowRemove
                  : row.leftText === undefined
                    ? styles.rowEmpty
                    : ''
              }`}
            >
              <span className={styles.lineNum}>{row.leftNum ?? ''}</span>
              <span className={styles.lineText}>{row.leftText ?? ''}</span>
            </div>
          ))}
        </div>
        <div
          ref={rightRef}
          className={styles.splitPane}
          onScroll={(event) => syncScroll(event.currentTarget, leftRef.current)}
        >
          {rows.map((row, index) => (
            <div
              key={`r-${index}`}
              className={`${styles.splitRow} ${
                row.kind === 'add'
                  ? styles.rowAdd
                  : row.rightText === undefined
                    ? styles.rowEmpty
                    : ''
              }`}
            >
              <span className={styles.lineNum}>{row.rightNum ?? ''}</span>
              <span className={styles.lineText}>{row.rightText ?? ''}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export const GitDiffViewer: React.FC<GitDiffViewerProps> = ({
  diff,
  defaultMode = 'unified',
  showModeToggle = false,
  fillHeight = false,
  className
}) => {
  const { t } = useTranslation()
  const [mode, setMode] = useState<GitDiffViewMode>(defaultMode)

  const rootClass = [styles.root, fillHeight ? styles.fill : '', className ?? '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClass}>
      {showModeToggle ? (
        <div className={styles.toolbar}>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'split' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('split')}
          >
            {t('workbench.diff_side_by_side', '并排')}
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'unified' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('unified')}
          >
            {t('workbench.diff_unified', '统一')}
          </button>
        </div>
      ) : null}

      {mode === 'split' ? (
        <SplitDiffBody diff={diff} />
      ) : (
        <div className={`${styles.unified} ${fillHeight ? styles.unifiedFill : ''}`}>
          <UnifiedDiffBody diff={diff} fillHeight={fillHeight} />
        </div>
      )}
    </div>
  )
}
