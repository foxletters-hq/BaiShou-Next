import React from 'react'
import { splitTextByKeyword } from '@baishou/shared'
import styles from './RagMemoryView.module.css'

export function RagMemoryHighlightedText({ text, keyword }: { text: string; keyword?: string }) {
  return (
    <>
      {splitTextByKeyword(text, keyword).map((part, index) =>
        part.kind === 'mark' ? (
          <mark key={index} className={styles.memoryEntryMark}>
            {part.value}
          </mark>
        ) : (
          <React.Fragment key={index}>{part.value}</React.Fragment>
        )
      )}
    </>
  )
}
