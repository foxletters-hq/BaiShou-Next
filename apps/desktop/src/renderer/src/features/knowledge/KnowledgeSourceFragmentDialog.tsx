import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button, MarkdownRenderer } from '@baishou/ui'
import { KnowledgeDialog } from './KnowledgeDialog'
import type { KnowledgeSourceFragment } from './knowledge-source-fragment.util'
import styles from './KnowledgePage.module.css'

type Props = {
  open: boolean
  loading: boolean
  error: string | null
  fragments: KnowledgeSourceFragment[]
  onClose: () => void
}

export const KnowledgeSourceFragmentDialog: React.FC<Props> = ({
  open,
  loading,
  error,
  fragments,
  onClose
}) => {
  const { t } = useTranslation()

  return (
    <KnowledgeDialog
      open={open}
      onClose={onClose}
      title={t('knowledge.fragment_preview_title', '原文片段')}
      aria-label={t('knowledge.fragment_preview_title', '原文片段')}
      className={styles.fragmentDialog}
    >
      {loading ? (
        <div className={styles.previewStatus}>
          {t('knowledge.fragment_preview_loading', '正在加载片段…')}
        </div>
      ) : null}
      {!loading && error ? <div className={styles.previewStatus}>{error}</div> : null}
      {!loading && !error && fragments.length === 0 ? (
        <div className={styles.previewStatus}>
          {t('knowledge.fragment_preview_empty', '没有可预览的原文片段')}
        </div>
      ) : null}
      {!loading && !error && fragments.length > 0 ? (
        <div className={styles.fragmentList}>
          {fragments.map((fragment) => (
            <article key={fragment.id} className={styles.fragmentCard}>
              <div className={styles.fragmentMeta}>
                <span>{fragment.sourceTitle}</span>
                <span>·</span>
                <span>
                  {fragment.kind === 'vector-chunk'
                    ? t('knowledge.citation_chunk', '片段 #{{index}}', {
                        index: fragment.index
                      })
                    : t('knowledge.fragment_window', '抽取窗口 #{{index}}', {
                        index: fragment.index
                      })}
                </span>
              </div>
              {fragment.excerpts.map((excerpt) => (
                <aside key={excerpt} className={styles.fragmentExcerpt}>
                  <div className={styles.fragmentExcerptLabel}>
                    {t('graph.source_excerpt_label', '关系摘录')}
                  </div>
                  <div className={styles.fragmentExcerptText}>{excerpt}</div>
                </aside>
              ))}
              {fragment.text ? (
                <div className={styles.previewMarkdown}>
                  <MarkdownRenderer content={fragment.text} />
                </div>
              ) : (
                <div className={styles.previewBox}>
                  {t('knowledge.fragment_missing_text', '还没有提取正文')}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : null}
      <div className={styles.dialogActions}>
        <Button type="button" onClick={onClose}>
          {t('common.close', '关闭')}
        </Button>
      </div>
    </KnowledgeDialog>
  )
}
