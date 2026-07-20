import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { isTextDiffablePath } from '@baishou/shared'
import type { GitManagementViewModel } from '@baishou/ui'
import styles from './GitWorkbenchPanel.module.css'

function formatGraphTime(date: Date | string): string {
  const value = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(value.getTime())) {
    return typeof date === 'string' ? date : String(date)
  }
  const now = Date.now()
  const diffMs = now - value.getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return value.toLocaleDateString()
}

export const GitWorkbenchGraphSection: React.FC<{ vm: GitManagementViewModel }> = ({ vm }) => {
  const { t } = useTranslation()
  const [sectionOpen, setSectionOpen] = useState(true)
  const {
    history,
    expandedCommit,
    handleSelectCommit,
    commitChanges,
    handleViewDiff,
    handleRollbackAll
  } = vm

  return (
    <section className={styles.vscodeSection}>
      <button
        type="button"
        className={styles.sectionHeader}
        onClick={() => setSectionOpen((open) => !open)}
      >
        <ChevronRight
          size={14}
          className={`${styles.sectionChevron} ${sectionOpen ? styles.sectionChevronOpen : ''}`}
        />
        <span className={styles.sectionTitle}>{t('workbench.git_graph', 'GRAPH')}</span>
        {history.length > 0 ? <span className={styles.sectionBadge}>{history.length}</span> : null}
      </button>

      {sectionOpen ? (
        <div className={styles.graphBody}>
          {history.length === 0 ? (
            <div className={styles.treeEmpty}>
              {t('version_control.no_history', '暂无提交历史')}
            </div>
          ) : (
            <div className={styles.graphList}>
              {history.map((entry, index) => {
                const isExpanded = expandedCommit === entry.commit.hash
                const isHead = entry.isCurrent
                const laneColor = isHead ? 'var(--color-primary, #5ba8f5)' : 'var(--wb-chrome-border, #d8dee4)'

                return (
                  <div key={entry.commit.hash} className={styles.graphRow}>
                    <div className={styles.graphLane} aria-hidden>
                      <div
                        className={`${styles.graphNode} ${isHead ? styles.graphNodeHead : ''}`}
                        style={{ borderColor: laneColor, background: isHead ? laneColor : 'transparent' }}
                      />
                      {index < history.length - 1 ? (
                        <div className={styles.graphLine} style={{ background: laneColor }} />
                      ) : null}
                    </div>

                    <div className={styles.graphContent}>
                      <button
                        type="button"
                        className={`${styles.graphCommit} ${isExpanded ? styles.graphCommitExpanded : ''}`}
                        onClick={() => void handleSelectCommit(entry.commit.hash)}
                      >
                        <span className={styles.graphMessage} title={entry.commit.message}>
                          {entry.commit.message || t('workbench.git_empty_commit', '(empty)')}
                        </span>
                        <span className={styles.graphMeta}>
                          {isHead ? (
                            <span className={styles.graphHeadBadge}>HEAD</span>
                          ) : null}
                          <span className={styles.graphTime}>
                            {formatGraphTime(entry.commit.date)}
                          </span>
                          <span className={styles.graphHash}>
                            {entry.commit.hash.slice(0, 7)}
                          </span>
                          {!isHead ? (
                            <button
                              type="button"
                              className={styles.treeActionBtn}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleRollbackAll(entry.commit.hash, entry.commit.message)
                              }}
                            >
                              {t('version_control.rollback', '回滚')}
                            </button>
                          ) : null}
                        </span>
                      </button>

                      {isExpanded && commitChanges.length > 0 ? (
                        <div className={styles.graphFiles}>
                          {commitChanges.map((change) => {
                            const canDiff = isTextDiffablePath(change.path)
                            const status =
                              change.status === 'added'
                                ? 'A'
                                : change.status === 'deleted'
                                  ? 'D'
                                  : 'M'
                            const statusClass =
                              change.status === 'added'
                                ? styles.badge_added
                                : change.status === 'deleted'
                                  ? styles.badge_deleted
                                  : styles.badge_modified

                            return (
                              <div
                                key={change.path}
                                className={`${styles.treeRow} ${canDiff ? styles.treeRowClickable : ''}`}
                                onClick={canDiff ? () => void handleViewDiff(change.path) : undefined}
                                role={canDiff ? 'button' : undefined}
                              >
                                <span className={`${styles.treeBadge} ${statusClass}`}>{status}</span>
                                <span className={styles.treePath} title={change.path}>
                                  {change.path}
                                </span>
                                <span className={styles.graphStats}>
                                  +{change.additions} -{change.deletions}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}
