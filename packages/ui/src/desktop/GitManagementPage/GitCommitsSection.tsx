import React from 'react'
import { Cloud, CloudOff } from 'lucide-react'
import { PageSizeSelector } from '../PageSizeSelector'
import { Pagination } from '../Pagination'
import type { GitManagementViewModel } from './useGitManagementPage'
import { gitHistoryTotalPages, isTextDiffablePath } from './git-management.utils'
import { GitDiffViewer } from './GitDiffViewer'

export interface GitCommitsSectionProps {
  vm: GitManagementViewModel
  compact?: boolean
}

function formatGraphTime(date: Date | string): string {
  const value = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(value.getTime())) {
    return typeof date === 'string' ? date : String(date)
  }
  const now = Date.now()
  const diffMs = now - value.getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return value.toLocaleDateString()
}

export const GitCommitsSection: React.FC<GitCommitsSectionProps> = ({ vm, compact = false }) => {
  const {
    t,
    history,
    expandedCommit,
    handleSelectCommit,
    commitChanges,
    handleViewDiff,
    expandedFile,
    selectedFileDiff,
    handleRollbackAll,
    pageSize,
    setPageSize,
    setPage,
    page,
    totalCount,
    remoteStatus
  } = vm

  const ahead = remoteStatus?.ahead ?? 0
  const unpublished = remoteStatus?.unpublished ?? true
  const remoteConfigured = Boolean(remoteStatus?.configured)

  const totalPages = gitHistoryTotalPages(totalCount, pageSize)
  const showPageSizeSelector = !compact && history.length > 0
  const showPageNumbers = !compact && (totalPages > 1 || page > 1)

  return (
    <div className="gmp-graph-section">
      {history.length === 0 ? (
        <div className="gmp-section-empty">{t('version_control.no_history', '暂无提交历史')}</div>
      ) : (
        <div className="gmp-graph-list">
          {history.map((entry, index) => {
            const isExpanded = expandedCommit === entry.commit.hash
            const isHead = entry.isCurrent
            const localOnly = remoteConfigured && (unpublished || (page === 1 && index < ahead))
            const laneColor = isHead ? 'var(--color-primary)' : 'var(--border-muted)'

            return (
              <div key={entry.commit.hash} className="gmp-graph-row">
                <div className="gmp-graph-lane" aria-hidden>
                  <div
                    className={`gmp-graph-node ${isHead ? 'gmp-graph-node-head' : ''}`}
                    style={{
                      borderColor: laneColor,
                      background: isHead ? laneColor : 'transparent'
                    }}
                  />
                  {index < history.length - 1 ? (
                    <div className="gmp-graph-line" style={{ background: laneColor }} />
                  ) : null}
                </div>

                <div className="gmp-graph-content">
                  <div
                    className={`gmp-graph-commit ${isExpanded ? 'gmp-graph-commit-expanded' : ''}`}
                    onClick={() => void handleSelectCommit(entry.commit.hash)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        void handleSelectCommit(entry.commit.hash)
                      }
                    }}
                  >
                    <span className="gmp-graph-message" title={entry.commit.message}>
                      {entry.commit.message || t('workbench.git_empty_commit', '(empty)')}
                    </span>
                    <span className="gmp-graph-meta">
                      {isHead ? <span className="gmp-graph-head-badge">HEAD</span> : null}
                      {remoteConfigured ? (
                        <span
                          className="gmp-graph-remote-icon"
                          title={
                            localOnly
                              ? t('version_control.commit_local_only', '仅在本地')
                              : t('version_control.commit_on_remote', '已在远程')
                          }
                        >
                          {localOnly ? <CloudOff size={12} /> : <Cloud size={12} />}
                        </span>
                      ) : null}
                      <span className="gmp-graph-time">{formatGraphTime(entry.commit.date)}</span>
                      <span className="gmp-graph-hash">{entry.commit.hash}</span>
                      {!isHead ? (
                        <button
                          className="gmp-btn-small"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleRollbackAll(entry.commit.hash, entry.commit.message)
                          }}
                        >
                          {t('version_control.rollback', '回滚')}
                        </button>
                      ) : (
                        <span className="gmp-current-badge">
                          {t('version_control.current_version', '当前版本')}
                        </span>
                      )}
                    </span>
                  </div>

                  {isExpanded ? (
                    <div className="gmp-graph-files">
                      {commitChanges.length === 0 ? (
                        <div className="gmp-section-empty">
                          {t('version_control.no_commit_files', '该提交没有可显示的文件变更')}
                        </div>
                      ) : (
                        commitChanges.map((change) => {
                          const canDiff = isTextDiffablePath(change.path)
                          const status =
                            change.status === 'added'
                              ? 'A'
                              : change.status === 'deleted'
                                ? 'D'
                                : 'M'
                          return (
                            <div key={change.path} className="gmp-tl-file">
                              <div
                                className={`gmp-tl-file-header ${canDiff ? 'gmp-file-row-clickable' : ''}`}
                                onClick={
                                  canDiff ? () => void handleViewDiff(change.path) : undefined
                                }
                              >
                                <span className={`gmp-tl-file-icon gmp-tl-file-${change.status}`}>
                                  {status}
                                </span>
                                <span className="gmp-tl-file-path">{change.path}</span>
                                <span className="gmp-tl-file-stats">
                                  +{change.additions} -{change.deletions}
                                </span>
                              </div>
                              {expandedFile === change.path && selectedFileDiff && !compact ? (
                                <GitDiffViewer diff={selectedFileDiff} />
                              ) : null}
                            </div>
                          )
                        })
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showPageSizeSelector || showPageNumbers ? (
        <div className="gmp-pagination-row">
          {showPageSizeSelector ? (
            <PageSizeSelector
              value={pageSize}
              options={[10, 20, 50, 100]}
              onChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          ) : null}
          {showPageNumbers ? (
            <Pagination
              current={page}
              total={totalPages}
              onChange={setPage}
              showJumper
              jumperPlaceholder={t('version_control.jump_page', '跳页')}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
