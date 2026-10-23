import React from 'react'
import { useTranslation } from 'react-i18next'
import type { FileChangePartData } from '@baishou/shared'
import styles from './FileChangeDiff.module.css'

export interface FileChangeDiffProps {
  data: FileChangePartData
  className?: string
}

type DiffRowKind = 'add' | 'del' | 'hunk' | 'context'

interface DiffRow {
  kind: DiffRowKind
  text: string
  oldNum: number | null
  newNum: number | null
  marker: string
}

function parseDiffRows(diff: string): DiffRow[] {
  const lines = diff.replace(/\r\n/g, '\n').split('\n')
  const rows: DiffRow[] = []
  let oldNum = 0
  let newNum = 0

  for (const line of lines) {
    if (
      line.includes('(diff truncated)') ||
      line.startsWith('--- ') ||
      line.startsWith('+++ ') ||
      line.startsWith('diff ') ||
      line.startsWith('index ')
    ) {
      continue
    }

    if (line.startsWith('@@')) {
      const match = /^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/.exec(line)
      if (match) {
        oldNum = Number(match[1])
        newNum = Number(match[2])
        // Pure create uses oldStart 0; next remove shouldn't bump from 0 incorrectly.
        if (oldNum > 0) oldNum -= 1
        if (newNum > 0) newNum -= 1
      }
      rows.push({ kind: 'hunk', text: line, oldNum: null, newNum: null, marker: '' })
      continue
    }

    if (line.startsWith('+')) {
      newNum += 1
      rows.push({
        kind: 'add',
        text: line.slice(1),
        oldNum: null,
        newNum,
        marker: '+'
      })
      continue
    }

    if (line.startsWith('-')) {
      oldNum += 1
      rows.push({
        kind: 'del',
        text: line.slice(1),
        oldNum,
        newNum: null,
        marker: '-'
      })
      continue
    }

    if (line.startsWith(' ') || line === '') {
      oldNum += 1
      newNum += 1
      rows.push({
        kind: 'context',
        text: line.startsWith(' ') ? line.slice(1) : line,
        oldNum,
        newNum,
        marker: ' '
      })
    }
  }

  return rows
}

function rowClass(kind: DiffRowKind): string {
  switch (kind) {
    case 'add':
      return styles.add
    case 'del':
      return styles.del
    case 'hunk':
      return styles.hunk
    default:
      return styles.context
  }
}

export const FileChangeDiff: React.FC<FileChangeDiffProps> = ({ data, className }) => {
  const { t } = useTranslation()

  if (!data.diff?.trim()) {
    return (
      <div className={`${styles.diff} ${styles.empty} ${className ?? ''}`}>
        {t('file_change.no_diff', '暂无行级 diff')}
      </div>
    )
  }

  const rows = parseDiffRows(data.diff)
  if (rows.length === 0) {
    return (
      <div className={`${styles.diff} ${styles.empty} ${className ?? ''}`}>
        {t('file_change.no_diff', '暂无行级 diff')}
      </div>
    )
  }

  return (
    <div className={`${styles.diff} ${className ?? ''}`}>
      {rows.map((row, index) => (
        <div key={index} className={`${styles.row} ${rowClass(row.kind)}`}>
          {row.kind === 'hunk' ? (
            <div className={styles.hunkText}>{row.text}</div>
          ) : (
            <>
              <span className={styles.gutterBar} aria-hidden />
              <span className={styles.lineNum}>{row.oldNum ?? ''}</span>
              <span className={styles.lineNum}>{row.newNum ?? ''}</span>
              <span className={styles.marker}>{row.marker}</span>
              <span className={styles.lineText}>{row.text}</span>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
