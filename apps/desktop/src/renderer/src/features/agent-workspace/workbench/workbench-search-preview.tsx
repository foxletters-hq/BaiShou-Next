import React from 'react'
import type { WorkspaceSearchMatch } from '@baishou/shared'
import styles from './WorkbenchSearchView.module.css'

const PREVIEW_PADDING = 30

export function truncatePreview(text: string, matchStart: number, matchEnd: number): {
  text: string
  matchStart: number
  matchEnd: number
  leadingEllipsis: boolean
  trailingEllipsis: boolean
} {
  if (text.length <= PREVIEW_PADDING * 2 + (matchEnd - matchStart)) {
    return {
      text,
      matchStart,
      matchEnd,
      leadingEllipsis: false,
      trailingEllipsis: false
    }
  }

  const center = Math.floor((matchStart + matchEnd) / 2)
  let start = Math.max(0, center - PREVIEW_PADDING)
  let end = Math.min(text.length, center + PREVIEW_PADDING)
  if (end - start < PREVIEW_PADDING * 2) {
    if (start === 0) {
      end = Math.min(text.length, start + PREVIEW_PADDING * 2)
    } else {
      start = Math.max(0, end - PREVIEW_PADDING * 2)
    }
  }

  const slice = text.slice(start, end)
  return {
    text: slice,
    matchStart: Math.max(0, matchStart - start),
    matchEnd: Math.max(0, matchEnd - start),
    leadingEllipsis: start > 0,
    trailingEllipsis: end < text.length
  }
}

export const SearchMatchPreview: React.FC<{ match: WorkspaceSearchMatch }> = ({ match }) => {
  const preview = truncatePreview(match.lineText, match.matchStart, match.matchEnd)
  const before = preview.text.slice(0, preview.matchStart)
  const hit = preview.text.slice(preview.matchStart, preview.matchEnd)
  const after = preview.text.slice(preview.matchEnd)

  return (
    <span className={styles.matchPreview}>
      {preview.leadingEllipsis ? <span className={styles.ellipsis}>…</span> : null}
      <span className={styles.matchText}>{before}</span>
      <mark className={styles.matchHighlight}>{hit}</mark>
      <span className={styles.matchText}>{after}</span>
      {preview.trailingEllipsis ? <span className={styles.ellipsis}>…</span> : null}
    </span>
  )
}
