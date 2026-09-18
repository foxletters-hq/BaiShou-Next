import React from 'react'
import { useTranslation } from 'react-i18next'
import { knowledgeIngestUserMessage } from './knowledge-ingest-user-error.util'
import type { NotebookGraphProgressView } from './notebook-graph-progress.util'
import styles from './KnowledgePage.module.css'

export type KnowledgeDetailJobProgressView = {
  visible: boolean
  vector: { detail: string; percent: number | null } | null
  graph: NotebookGraphProgressView | null
}

export function KnowledgeDetailJobBanner({
  activeTab,
  jobProgress,
  status,
  error
}: {
  activeTab: string
  jobProgress: KnowledgeDetailJobProgressView
  status: string
  error: string
}) {
  const { t } = useTranslation()
  return (
    <>
      {jobProgress.visible && activeTab !== 'graph' ? (
        <div className={styles.jobProgress}>
          {jobProgress.vector ? (
            <div className={styles.jobProgressRow}>
              <span className={styles.jobProgressLabel}>
                {t('knowledge.job_vector_label', '向量整理')}
              </span>
              <div className={styles.jobProgressBody}>
                <span className={styles.jobProgressDetail}>{jobProgress.vector.detail}</span>
                {jobProgress.vector.percent != null ? (
                  <div
                    className={styles.jobProgressBar}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={jobProgress.vector.percent}
                  >
                    <div
                      className={styles.jobProgressFill}
                      style={{
                        width: `${Math.max(0, Math.min(100, jobProgress.vector.percent))}%`
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {jobProgress.graph ? (
            <div className={styles.jobProgressRow}>
              <span className={styles.jobProgressLabel}>
                {t('knowledge.job_graph_label', '图谱抽取')}
              </span>
              <div className={styles.jobProgressBody}>
                <span className={styles.jobProgressDetail}>
                  {[jobProgress.graph.headline, jobProgress.graph.detail]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <div
                  className={styles.jobProgressBar}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={jobProgress.graph.percent}
                >
                  <div
                    className={styles.jobProgressFill}
                    style={{
                      width: `${Math.max(0, Math.min(100, jobProgress.graph.percent))}%`
                    }}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {status && !jobProgress.visible ? <p className={styles.bannerStatus}>{status}</p> : null}
      {error ? <p className={styles.bannerError}>{knowledgeIngestUserMessage(error, t)}</p> : null}
    </>
  )
}
