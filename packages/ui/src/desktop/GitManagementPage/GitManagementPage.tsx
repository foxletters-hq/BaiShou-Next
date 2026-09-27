import i18n from 'i18next'
import React, { useEffect, useState, useRef, useCallback } from 'react'
import './GitManagementPage.css'
import type { GitManagementPageProps } from './git-management.types'
import { useGitManagementPage } from './useGitManagementPage'
import { GitRemoteStatusSection } from './GitRemoteStatusSection'
import { GitVersionCommitBar } from './GitVersionCommitBar'
import { GitStagedSection } from './GitStagedSection'
import { GitChangesSection } from './GitChangesSection'
import { GitCommitsSection } from './GitCommitsSection'
import { GitDiffViewer } from './GitDiffViewer'
import { GitDestructiveConfirmDialog } from './GitDestructiveConfirmDialog'
import { SettingsPageChrome } from '../shared/SettingsPageChrome'
import { HelpTooltip } from '../HelpTooltip'
import { Button } from '../Button/Button'
import { FileText, GitCompare, History, FolderGit2, X } from 'lucide-react'

const INCLUDED_SCOPES = [
  [
    'version_control.scope_journals',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitManagementPage.L18', '日记')
  ],
  [
    'version_control.scope_archives',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitManagementPage.L19', '总结')
  ],
  [
    'version_control.scope_sessions',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitManagementPage.L20', '会话')
  ],
  [
    'version_control.scope_graph',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitManagementPage.L21', '图谱')
  ],
  [
    'version_control.scope_memory',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitManagementPage.L22', '记忆')
  ],
  [
    'version_control.scope_assistants',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitManagementPage.L23', '助手')
  ],
  [
    'version_control.scope_attachments',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitManagementPage.L24', '附件')
  ],
  [
    'version_control.scope_notebooks',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitManagementPage.L25', '知识库原文')
  ]
] as const

const EXCLUDED_SCOPES = [
  [
    'version_control.scope_excluded_app',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitManagementPage.L29', '应用数据')
  ],
  [
    'version_control.scope_excluded_db',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitManagementPage.L30', '数据库')
  ],
  [
    'version_control.scope_excluded_conflict',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitManagementPage.L31', '冲突备份')
  ],
  [
    'version_control.scope_excluded_temp',
    i18n.t('auto.packages.ui.src.desktop.GitManagementPage.GitManagementPage.L32', '快照与临时文件')
  ]
] as const

const GitScopeTooltipContent: React.FC<{ t: any }> = ({ t }) => {
  return (
    <div className="gmp-scope-tooltip-content">
      <div className="gmp-scope-tooltip-header">
        <h4 className="gmp-scope-tooltip-title">
          {t('version_control.scope_title', '版本控制管理范围')}
        </h4>
        <p className="gmp-scope-tooltip-lead">
          {t('version_control.scope_lead', '跟踪各工作区的写作与原文。仅桌面端提供。')}
        </p>
      </div>

      <div className="gmp-scope-tooltip-section">
        <div className="gmp-scope-tooltip-label gmp-scope-tooltip-label-inc">
          ✓ {t('version_control.scope_included', '纳入跟踪')}
        </div>
        <div className="gmp-scope-tooltip-chips">
          {INCLUDED_SCOPES.map(([key, fallback]) => (
            <span key={key} className="gmp-scope-tooltip-chip gmp-scope-chip-inc">
              {t(key, fallback)}
            </span>
          ))}
        </div>
      </div>

      <div className="gmp-scope-tooltip-section">
        <div className="gmp-scope-tooltip-label gmp-scope-tooltip-label-exc">
          ✕ {t('version_control.scope_excluded', '不纳入跟踪')}
        </div>
        <div className="gmp-scope-tooltip-chips">
          {EXCLUDED_SCOPES.map(([key, fallback]) => (
            <span key={key} className="gmp-scope-tooltip-chip gmp-scope-chip-exc">
              {t(key, fallback)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export const GitManagementPage: React.FC<GitManagementPageProps> = (props) => {
  const vm = useGitManagementPage(props)
  const [leftTab, setLeftTab] = useState<'workspace' | 'history'>('workspace')

  // 双栏宽度与拖拽调整（持久化到 localStorage）
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('gmp_split_left_width')
      if (saved) {
        const val = Number(saved)
        if (Number.isFinite(val) && val >= 280 && val <= 700) {
          return val
        }
      }
    } catch {}
    return 380
  })

  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startDragInfoRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      startDragInfoRef.current = {
        startX: e.clientX,
        startWidth: leftWidth
      }
    },
    [leftWidth]
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!startDragInfoRef.current) return
      const deltaX = e.clientX - startDragInfoRef.current.startX
      const containerWidth = containerRef.current?.getBoundingClientRect().width || 1000
      const minW = 260
      const maxW = Math.max(minW, Math.min(680, containerWidth - 280))
      const nextWidth = Math.max(minW, Math.min(maxW, startDragInfoRef.current.startWidth + deltaX))
      setLeftWidth(nextWidth)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      startDragInfoRef.current = null
      setLeftWidth((w) => {
        try {
          localStorage.setItem('gmp_split_left_width', String(Math.round(w)))
        } catch {}
        return w
      })
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging])

  // 当屏幕或容器缩小时，自适应收拢左侧宽度，防止右侧 Diff 区域被挤压
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width
        if (w > 0) {
          setLeftWidth((cur) => {
            const minW = 260
            const maxW = Math.max(minW, w - 280)
            return Math.max(minW, Math.min(maxW, cur))
          })
        }
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    void vm.handleRefreshStatus({ fetch: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.isInitialized])

  useEffect(() => {
    if (!vm.isInitialized) return
    void vm.handleLoadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.isInitialized, vm.page, vm.pageSize])

  // 派生当前选中的 Diff 目标（优先工作区，其次提交历史）
  let activeDiff = null
  let activePath = ''
  let activeType: 'staged' | 'unstaged' | 'history' = 'unstaged'
  let activeBadgeLabel = ''

  if (vm.expandedWorkingFile && vm.workingFileDiff) {
    activeDiff = vm.workingFileDiff
    activePath = vm.expandedWorkingFile.path
    activeType = vm.expandedWorkingFile.staged ? 'staged' : 'unstaged'
    activeBadgeLabel = vm.expandedWorkingFile.staged
      ? vm.t('version_control.staged_changes', '已暂存')
      : vm.t('version_control.changes', '未暂存变更')
  } else if (vm.expandedFile && vm.selectedFileDiff) {
    activeDiff = vm.selectedFileDiff
    activePath = vm.expandedFile
    activeType = 'history'
    activeBadgeLabel = vm.expandedCommit
      ? `Commit: ${vm.expandedCommit.slice(0, 7)}`
      : vm.t('workbench.git_history', '提交历史')
  }

  const handleCloseDiff = () => {
    vm.setExpandedWorkingFile(null)
    vm.setWorkingFileDiff(null)
    vm.setExpandedFile(null)
    vm.setSelectedFileDiff(null)
  }

  const workspaceCount = vm.stagedCount + vm.unstagedCount

  return (
    <SettingsPageChrome
      title={vm.t('version_control.title', '版本控制')}
      titleAccessory={
        <HelpTooltip
          tooltipClassName="gmp-scope-tooltip"
          content={<GitScopeTooltipContent t={vm.t} />}
        />
      }
      layout="stack"
    >
      <div className="git-management-page">
        <div className="gmp-split-layout" ref={containerRef}>
          {/* ─── 左侧：状态、快速提交、工作区变更与提交历史（无卡片嵌套，高效利用空间） ─── */}
          <div className="gmp-split-left" style={{ width: leftWidth }}>
            <GitRemoteStatusSection vm={vm} />

            {vm.isInitialized ? (
              <>
                <div className="gmp-sidebar-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={leftTab === 'workspace'}
                    className={`gmp-sidebar-tab ${leftTab === 'workspace' ? 'gmp-sidebar-tab-active' : ''}`}
                    onClick={() => setLeftTab('workspace')}
                  >
                    <FolderGit2 size={14} />
                    <span>{vm.t('version_control.workspace_section', '工作区变更')}</span>
                    {workspaceCount > 0 ? (
                      <span className="gmp-sidebar-tab-badge">{workspaceCount}</span>
                    ) : null}
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={leftTab === 'history'}
                    className={`gmp-sidebar-tab ${leftTab === 'history' ? 'gmp-sidebar-tab-active' : ''}`}
                    onClick={() => setLeftTab('history')}
                  >
                    <History size={14} />
                    <span>{vm.t('workbench.git_history', '提交历史')}</span>
                    {vm.totalCount > 0 ? (
                      <span className="gmp-sidebar-tab-badge gmp-sidebar-tab-badge-muted">
                        {vm.totalCount}
                      </span>
                    ) : null}
                  </button>
                </div>

                <div className="gmp-sidebar-body">
                  {leftTab === 'workspace' ? (
                    <>
                      <GitVersionCommitBar vm={vm} />
                      <GitStagedSection
                        vm={vm}
                        inlineDiff={false}
                        activeFilePath={activeType !== 'history' ? activePath : null}
                      />
                      <GitChangesSection
                        vm={vm}
                        inlineDiff={false}
                        activeFilePath={activeType !== 'history' ? activePath : null}
                      />
                    </>
                  ) : (
                    <GitCommitsSection
                      vm={vm}
                      inlineDiff={false}
                      activeFilePath={activeType === 'history' ? activePath : null}
                    />
                  )}
                </div>
              </>
            ) : null}
          </div>

          {/* ─── 拖拽调整双栏宽度的分隔线 ─── */}
          <div
            className={`gmp-split-resizer ${isDragging ? 'gmp-split-resizer-dragging' : ''}`}
            onMouseDown={handleMouseDown}
            role="separator"
            aria-orientation="vertical"
            aria-label={vm.t('version_control.resize_split', '调整分栏宽度')}
          />

          {/* ─── 右侧：代码级 Diff 对比主舞台 ─── */}
          <div className="gmp-split-right">
            {activeDiff ? (
              <div className="gmp-diff-stage">
                <div className="gmp-diff-stage-header">
                  <div className="gmp-diff-stage-title-group">
                    <FileText size={16} className="gmp-diff-stage-icon" aria-hidden />
                    <span className="gmp-diff-stage-path" title={activePath}>
                      {activePath}
                    </span>
                    <span className={`gmp-diff-stage-badge gmp-diff-stage-badge-${activeType}`}>
                      {activeBadgeLabel}
                    </span>
                  </div>

                  <div className="gmp-diff-stage-actions">
                    {activeType === 'unstaged' ? (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => void vm.handleStageFile(activePath)}
                      >
                        {vm.t('version_control.stage', '暂存')}
                      </Button>
                    ) : null}

                    {activeType === 'staged' ? (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => void vm.handleUnstageFile(activePath)}
                      >
                        {vm.t('version_control.unstage', '取消暂存')}
                      </Button>
                    ) : null}

                    <button
                      type="button"
                      className="gmp-diff-close-btn"
                      onClick={handleCloseDiff}
                      title={vm.t('common.close', '关闭对比')}
                      aria-label={vm.t('common.close', '关闭对比')}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                <div className="gmp-diff-viewer-wrap">
                  <GitDiffViewer diff={activeDiff} fillHeight showModeToggle />
                </div>
              </div>
            ) : (
              <div className="gmp-diff-empty-stage">
                <div className="gmp-diff-empty-card">
                  <div className="gmp-diff-empty-icon-wrap" aria-hidden>
                    <GitCompare size={36} strokeWidth={1.75} />
                  </div>
                  <h4 className="gmp-diff-empty-title">
                    {vm.t('version_control.diff_empty_title', '差异对比主视图')}
                  </h4>
                  <p className="gmp-diff-empty-desc">
                    {vm.t(
                      'version_control.diff_empty_desc',
                      '在左侧选择「工作区变更」或「提交历史」中的文件，即可在此查看代码级差异对比。'
                    )}
                  </p>

                  <div className="gmp-diff-empty-stats">
                    <div className="gmp-diff-empty-stat-item">
                      <span className="gmp-diff-empty-stat-val">{vm.stagedCount}</span>
                      <span className="gmp-diff-empty-stat-lbl">
                        {vm.t('version_control.staged_changes', '已暂存')}
                      </span>
                    </div>
                    <div className="gmp-diff-empty-stat-divider" aria-hidden />
                    <div className="gmp-diff-empty-stat-item">
                      <span className="gmp-diff-empty-stat-val">{vm.unstagedCount}</span>
                      <span className="gmp-diff-empty-stat-lbl">
                        {vm.t('version_control.changes', '未暂存')}
                      </span>
                    </div>
                    <div className="gmp-diff-empty-stat-divider" aria-hidden />
                    <div className="gmp-diff-empty-stat-item">
                      <span className="gmp-diff-empty-stat-val">{vm.totalCount}</span>
                      <span className="gmp-diff-empty-stat-lbl">
                        {vm.t('workbench.git_history', '提交历史')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <GitDestructiveConfirmDialog
          request={vm.destructiveConfirm}
          isConfirming={vm.isConfirmingDestructive}
          onConfirm={vm.confirmDestructiveAction}
          onCancel={vm.cancelDestructiveAction}
        />
      </div>
    </SettingsPageChrome>
  )
}
