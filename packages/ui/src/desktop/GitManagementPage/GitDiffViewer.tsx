import React, { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FileDiff } from '@baishou/shared'
import {
  fileDiffToSplitRows,
  fileDiffToUnifiedRows,
  type GitInlineChange,
  type GitUnifiedDiffRow
} from './git-diff.utils'
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

const InlineText: React.FC<{ text: string; inline?: GitInlineChange }> = ({ text, inline }) => {
  if (!inline) return <>{text}</>
  return (
    <>
      {inline.prefix}
      <span className={styles.inlineChanged}>{inline.changed}</span>
      {inline.suffix}
    </>
  )
}

function unifiedRowClass(kind: GitUnifiedDiffRow['kind']): string {
  switch (kind) {
    case 'add':
      return styles.lineAdd
    case 'remove':
      return styles.lineRemove
    case 'hunk':
      return styles.hunkHeader
    case 'meta':
      return styles.metaLine
    default:
      return styles.lineNormal
  }
}

const UnifiedDiffBody: React.FC<{ diff: FileDiff }> = ({ diff }) => {
  const { t } = useTranslation()
  const rows = fileDiffToUnifiedRows(diff)

  if (rows.length === 0) {
    return <div className={styles.empty}>{t('version_control.no_diff', '没有可显示的差异')}</div>
  }

  return (
    <div className={styles.unifiedContent} role="table" aria-label={t('workbench.diff_unified', '统一')}>
      {rows.map((row, index) => {
        if (row.kind === 'hunk') {
          return (
            <div key={index} className={`${styles.unifiedRow} ${styles.hunkHeader}`}>
              <span className={styles.hunkText}>{row.text}</span>
            </div>
          )
        }
        if (row.kind === 'meta') {
          return (
            <div key={index} className={`${styles.unifiedRow} ${styles.metaLine}`}>
              <span className={styles.hunkText}>
                {t('version_control.no_newline_eof', '文件末尾没有换行符')}
              </span>
            </div>
          )
        }
        return (
          <div key={index} className={`${styles.unifiedRow} ${unifiedRowClass(row.kind)}`}>
            <span className={styles.gutterBar} aria-hidden />
            <span className={styles.lineNum}>{row.oldNum ?? ''}</span>
            <span className={styles.lineNum}>{row.newNum ?? ''}</span>
            <span className={styles.marker}>{row.marker}</span>
            <span className={styles.lineText}>
              <InlineText text={row.text} inline={row.inline} />
            </span>
          </div>
        )
      })}
    </div>
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
    return <div className={styles.empty}>{t('version_control.no_diff', '没有可显示的差异')}</div>
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
                row.kind === 'remove' || row.kind === 'replace'
                  ? styles.rowRemove
                  : row.leftText === undefined
                    ? styles.rowEmpty
                    : ''
              }`}
            >
              <span className={styles.lineNum}>{row.leftNum ?? ''}</span>
              <span className={styles.lineText}>
                <InlineText text={row.leftText ?? ''} inline={row.leftInline} />
              </span>
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
                row.kind === 'add' || row.kind === 'replace'
                  ? styles.rowAdd
                  : row.rightText === undefined
                    ? styles.rowEmpty
                    : ''
              }`}
            >
              <span className={styles.lineNum}>{row.rightNum ?? ''}</span>
              <span className={styles.lineText}>
                <InlineText text={row.rightText ?? ''} inline={row.rightInline} />
              </span>
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
          <UnifiedDiffBody diff={diff} />
        </div>
      )}
    </div>
  )
}
