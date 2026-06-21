import React from 'react'
import type { GitManagementViewModel } from './useGitManagementPage'
import { getFileStatusIcon, isTextDiffablePath } from './git-management.utils'
import { GitDiffViewer } from './GitDiffViewer'

export interface GitChangesSectionProps {
  vm: GitManagementViewModel
}

export const GitChangesSection: React.FC<GitChangesSectionProps> = ({ vm }) => {
  const {
    t,
    isInitialized,
    expandedSections,
    toggleSection,
    unstagedCount,
    gitStatus,
    handleStageAll,
    handleDiscardAll,
    handleViewWorkingDiff,
    handleStageFile,
    handleDiscardFile,
    expandedWorkingFile,
    workingFileDiff
  } = vm

  if (!isInitialized) return null

  return (
    <div className="gmp-collapsible-section">
      <div className="gmp-collapsible-header" onClick={() => toggleSection('changes')}>
        <span className="gmp-collapsible-arrow">{expandedSections.changes ? '▾' : '▸'}</span>
        <span className="gmp-collapsible-title">{t('version_control.changes', 'Changes')}</span>
        {unstagedCount > 0 && <span className="gmp-collapsible-badge">{unstagedCount}</span>}
        {unstagedCount > 0 && (
          <button
            className="gmp-btn-tiny"
            onClick={(e) => {
              e.stopPropagation()
              handleStageAll()
            }}
          >
            {t('version_control.stage_all', '全部暂存')}
          </button>
        )}
        {unstagedCount > 0 && (
          <button
            className="gmp-btn-tiny"
            onClick={(e) => {
              e.stopPropagation()
              handleDiscardAll()
            }}
          >
            {t('version_control.discard_all', '全部撤销')}
          </button>
        )}
      </div>
      {expandedSections.changes && (
        <div className="gmp-collapsible-body">
          {unstagedCount === 0 ? (
            <div className="gmp-section-empty">{t('version_control.no_changes', '没有变更')}</div>
          ) : (
            <>
              {gitStatus!.unstaged.map((file) => {
                const canDiff = isTextDiffablePath(file.path)
                return (
                  <div key={file.path}>
                    <div
                      className={`gmp-file-row ${canDiff ? 'gmp-file-row-clickable' : ''}`}
                      onClick={canDiff ? () => handleViewWorkingDiff(file.path, false) : undefined}
                    >
                      <span className={`gmp-file-badge gmp-file-${file.unstagedStatus}`}>
                        {getFileStatusIcon(file.unstagedStatus)}
                      </span>
                      <span className="gmp-file-path">{file.path}</span>
                      <div className="gmp-file-actions">
                        <button
                          className="gmp-btn-tiny"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStageFile(file.path)
                          }}
                        >
                          {t('version_control.stage', '暂存')}
                        </button>
                        <button
                          className="gmp-btn-tiny"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDiscardFile(file.path)
                          }}
                        >
                          {t('version_control.discard', '撤销')}
                        </button>
                      </div>
                    </div>
                    {expandedWorkingFile?.path === file.path &&
                      !expandedWorkingFile.staged &&
                      workingFileDiff && <GitDiffViewer diff={workingFileDiff} />}
                  </div>
                )
              })}
              {gitStatus!.untracked.map((file) => {
                const canDiff = isTextDiffablePath(file)
                return (
                  <div key={file}>
                    <div
                      className={`gmp-file-row ${canDiff ? 'gmp-file-row-clickable' : ''}`}
                      onClick={canDiff ? () => handleViewWorkingDiff(file, false) : undefined}
                    >
                      <span className="gmp-file-badge gmp-file-untracked">U</span>
                      <span className="gmp-file-path">{file}</span>
                      <div className="gmp-file-actions">
                        <button
                          className="gmp-btn-tiny"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStageFile(file)
                          }}
                        >
                          {t('version_control.stage', '暂存')}
                        </button>
                        <button
                          className="gmp-btn-tiny"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDiscardFile(file, { untracked: true })
                          }}
                        >
                          {t('version_control.discard', '撤销')}
                        </button>
                      </div>
                    </div>
                    {expandedWorkingFile?.path === file &&
                      !expandedWorkingFile.staged &&
                      workingFileDiff && <GitDiffViewer diff={workingFileDiff} />}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
