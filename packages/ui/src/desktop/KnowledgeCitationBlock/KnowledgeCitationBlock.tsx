import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  formatKnowledgeCitationLocation,
  type KnowledgeCitationView
} from '@baishou/shared'
import styles from './KnowledgeCitationBlock.module.css'

export function KnowledgeCitationBlock({
  citations
}: {
  citations: KnowledgeCitationView[]
}) {
  const { t } = useTranslation()
  if (citations.length === 0) return null

  return (
    <div className={styles.wrap}>
      <div className={styles.list}>
        <h3 className={styles.title}>{t('knowledge.citations', '引用')}</h3>
        {citations.map((citation, index) => {
          const location = formatKnowledgeCitationLocation(citation)
          const notebook = citation.notebookName.trim()
          return (
            <article
              key={`${citation.sourceId || citation.title}-${index}`}
              className={styles.item}
            >
              <div className={styles.itemTitle}>
                [{index + 1}] {notebook ? `${notebook} · ` : ''}
                {citation.title}
                {location ? `（${location}）` : ''}
              </div>
              {citation.excerpt ? <div className={styles.excerpt}>{citation.excerpt}</div> : null}
            </article>
          )
        })}
      </div>
    </div>
  )
}
