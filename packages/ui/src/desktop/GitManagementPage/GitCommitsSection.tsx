import React from 'react'
import { PageSizeSelector, Pagination } from '@baishou/ui'
import type { GitManagementViewModel } from './useGitManagementPage'
import { isTextDiffablePath } from './git-management.utils'
import { GitDiffViewer } from './GitDiffViewer'

export interface GitCommitsSectionProps {
  vm: GitManagementViewModel
}

export const GitCommitsSection: React.FC<GitCommitsSectionProps> = ({ vm }) => {
  const {
    t,
    expandedSections,
    toggleSection,
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
    totalCount
  } = vm

  return (
    <div className="gmp-collapsible-section">
      <div className="gmp-collapsible-header" onClick={() => toggleSection('commits')}>
        <span className="gmp-collapsible-arrow">{expandedSections.commits ? '▾' : '▸'}</span>
        <span className="gmp-collapsible-title">
          {t('version_control.recent_commits', 'Recent Commits')}
        </span>
        {history.length > 0 && <span className="gmp-collapsible-badge">{history.length}</span>}
      </div>
      {expandedSections.commits && (
        <div className="gmp-collapsible-body">
          {history.length === 0 ? (
            <div className="gmp-section-empty">
              {t('version_control.no_history', '暂无提交历史')}
            </div>
          ) : (
            <>
              <div className="gmp-timeline">
                {history.map((entry) => (
                  <div key={entry.commit.hash} className="gmp-tl-commit">
                    <div className="gmp-tl-gutter">
                      <div
                        className={`gmp-tl-dot ${entry.isCurrent ? 'gmp-tl-dot-current' : ''}`}
                      />
                      <div className="gmp-tl-line" />
                    </div>

                    <div className="gmp-tl-body">
                      <div
                        className={`gmp-tl-header ${expandedCommit === entry.commit.hash ? 'gmp-tl-header-expanded' : ''}`}
                        onClick={() => handleSelectCommit(entry.commit.hash)}
                      >
                        <span className="gmp-tl-message">{entry.commit.message}</span>
                        <span className="gmp-tl-meta">
                          <span className="gmp-tl-date">
                            {new Date(entry.commit.date).toLocaleString()}
                          </span>
                          <span className="gmp-tl-hash">{entry.commit.hash}</span>
                          <button
                            className="gmp-btn-small"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRollbackAll(entry.commit.hash, entry.commit.message)
                            }}
                            disabled={entry.isCurrent}
                          >
                            {t('version_control.rollback', '回滚')}
                          </button>
                          {entry.isCurrent && (
                            <span className="gmp-current-badge">
                              {t('version_control.current_version', '当前版本')}
                            </span>
                          )}
                        </span>
                      </div>

                      {expandedCommit === entry.commit.hash && (
                        <div className="gmp-tl-changes">
                          {commitChanges.map((change) => {
                            const canDiff = isTextDiffablePath(change.path)
                            return (
                              <div key={change.path} className="gmp-tl-file">
                                <div
                                  className={`gmp-tl-file-header ${canDiff ? 'gmp-file-row-clickable' : ''}`}
                                  onClick={canDiff ? () => handleViewDiff(change.path) : undefined}
                                >
                                  <span className={`gmp-tl-file-icon gmp-tl-file-${change.status}`}>
                                    {change.status === 'added'
                                      ? 'A'
                                      : change.status === 'deleted'
                                        ? 'D'
                                        : 'M'}
                                  </span>
                                  <span className="gmp-tl-file-path">{change.path}</span>
                                  <span className="gmp-tl-file-stats">
                                    +{change.additions} -{change.deletions}
                                  </span>
                                </div>

                                {expandedFile === change.path && selectedFileDiff && (
                                  <GitDiffViewer diff={selectedFileDiff} />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="gmp-pagination-row">
                <PageSizeSelector
                  value={pageSize}
                  options={[10, 20, 50, 100]}
                  onChange={(size) => {
                    setPageSize(size)
                    setPage(1)
                  }}
                />
                <Pagination
                  current={page}
                  total={Math.max(1, Math.ceil(totalCount / pageSize))}
                  onChange={setPage}
                  showJumper
                  jumperPlaceholder={t('version_control.jump_page', '跳页')}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
