import React from 'react'
import type { GitManagementViewModel } from './useGitManagementPage'
import { getFileStatusIcon, isTextDiffablePath } from './git-management.utils'
import { GitDiffViewer } from './GitDiffViewer'

export interface GitStagedSectionProps {
  vm: GitManagementViewModel
}

export const GitStagedSection: React.FC<GitStagedSectionProps> = ({ vm }) => {
  const {
    t,
    isInitialized,
    expandedSections,
    toggleSection,
    stagedCount,
    gitStatus,
    handleUnstageAll,
    handleViewWorkingDiff,
    handleUnstageFile,
    expandedWorkingFile,
    workingFileDiff
  } = vm

  if (!isInitialized) return null

  return (
    <div className="gmp-collapsible-section">
      <div className="gmp-collapsible-header" onClick={() => toggleSection('staged')}>
        <span className="gmp-collapsible-arrow">{expandedSections.staged ? '▾' : '▸'}</span>
        <span className="gmp-collapsible-title">
          {t('version_control.staged_changes', 'Staged Changes')}
        </span>
        {stagedCount > 0 && <span className="gmp-collapsible-badge">{stagedCount}</span>}
        {stagedCount > 0 && (
          <button
            className="gmp-btn-tiny"
            onClick={(e) => {
              e.stopPropagation()
              handleUnstageAll()
            }}
          >
            {t('version_control.unstage_all', '全部取消暂存')}
          </button>
        )}
      </div>
      {expandedSections.staged && (
        <div className="gmp-collapsible-body">
          {stagedCount === 0 ? (
            <div className="gmp-section-empty">
              {t('version_control.no_staged_changes', '没有已暂存的变更')}
            </div>
          ) : (
            gitStatus!.staged.map((file) => {
              const canDiff = isTextDiffablePath(file.path)
              return (
                <div key={file.path}>
                  <div
                    className={`gmp-file-row ${canDiff ? 'gmp-file-row-clickable' : ''}`}
                    onClick={canDiff ? () => handleViewWorkingDiff(file.path, true) : undefined}
                  >
                    <span className={`gmp-file-badge gmp-file-${file.stagedStatus}`}>
                      {getFileStatusIcon(file.stagedStatus)}
                    </span>
                    <span className="gmp-file-path">{file.path}</span>
                    <div className="gmp-file-actions">
                      <button
                        className="gmp-btn-tiny"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUnstageFile(file.path)
                        }}
                      >
                        {t('version_control.unstage', '取消暂存')}
                      </button>
                    </div>
                  </div>
                  {expandedWorkingFile?.path === file.path &&
                    expandedWorkingFile.staged &&
                    workingFileDiff && <GitDiffViewer diff={workingFileDiff} />}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
