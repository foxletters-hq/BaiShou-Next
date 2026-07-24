import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AgentToolsView,
  SettingsPageChrome,
  type AgentToolsConfig
} from '@baishou/ui'
import {
  DEFAULT_WORKSPACE_TOOL_MANAGEMENT_CONFIG,
  type AgentWorkspaceEntry,
  type WorkspaceToolManagementConfig
} from '@baishou/shared'
import seg from '@baishou/ui/desktop/shared/SegmentedControl.module.css'
import { BaishouAgentGateSettingsSection } from './BaishouAgentGateSettingsSection'
import styles from './AgentToolsPane.module.css'

type WorkspaceGateTab = 'permissions' | 'tools'

/** 工作台权限：按工作区配置能力矩阵；工具开关作为次级页签 */
export const WorkspaceGatePane: React.FC = () => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<WorkspaceGateTab>('permissions')
  const [toolsSubpageActive, setToolsSubpageActive] = useState(false)
  const [workspaces, setWorkspaces] = useState<AgentWorkspaceEntry[]>([])
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [workspaceTools, setWorkspaceTools] = useState<WorkspaceToolManagementConfig>(
    DEFAULT_WORKSPACE_TOOL_MANAGEMENT_CONFIG
  )
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false)

  const loadWorkspaces = useCallback(async () => {
    setLoadingWorkspaces(true)
    try {
      const list = (await window.api.agentWorkspace?.listWorkspaces?.()) ?? []
      const rows = Array.isArray(list) ? list : []
      setWorkspaces(rows)
      const lastActive =
        (await window.api.agentWorkspace?.getLastActiveWorkspaceId?.()) ?? undefined
      setWorkspaceId((prev) => {
        if (prev && rows.some((item) => item.id === prev)) return prev
        if (lastActive && rows.some((item) => item.id === lastActive)) return lastActive
        return rows[0]?.id ?? null
      })
    } catch (error) {
      console.error('[WorkspaceGatePane] load workspaces failed:', error)
      setWorkspaces([])
      setWorkspaceId(null)
    } finally {
      setLoadingWorkspaces(false)
    }
  }, [])

  useEffect(() => {
    void loadWorkspaces()
  }, [loadWorkspaces])

  useEffect(() => {
    if (!workspaceId) {
      setWorkspaceTools(DEFAULT_WORKSPACE_TOOL_MANAGEMENT_CONFIG)
      return
    }
    let cancelled = false
    void window.api.settings
      .getWorkspaceToolManagement(workspaceId)
      .then((config) => {
        if (!cancelled) setWorkspaceTools(config)
      })
      .catch((error) => {
        console.error('[WorkspaceGatePane] load workspace tools failed:', error)
        if (!cancelled) setWorkspaceTools(DEFAULT_WORKSPACE_TOOL_MANAGEMENT_CONFIG)
      })
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  const gateScope = useMemo(
    () =>
      workspaceId
        ? ({ kind: 'workspace' as const, workspaceId })
        : ({ kind: 'companion' as const }),
    [workspaceId]
  )

  const handleWorkspaceToolsChange = async (config: AgentToolsConfig) => {
    if (!workspaceId) return
    const next: WorkspaceToolManagementConfig = {
      disabledToolIds: config.disabledToolIds ?? [],
      customConfigs: (config.customConfigs ?? {}) as Record<string, Record<string, unknown>>
    }
    setWorkspaceTools(next)
    try {
      const saved = await window.api.settings.setWorkspaceToolManagement(workspaceId, next)
      setWorkspaceTools(saved)
    } catch (error) {
      console.error('[WorkspaceGatePane] save workspace tools failed:', error)
    }
  }

  const hideTabHeader = tab === 'tools' && toolsSubpageActive

  return (
    <div
      className="settings-pane settings-pane-full"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <SettingsPageChrome title={t('settings.workspace_gate_page_title', '工作台权限')} layout="stack">
        <div className={styles.page}>
          {hideTabHeader ? null : (
            <div className={styles.tabHeader}>
              <div className={styles.navStacks}>
                <div className={seg.group}>
                  <button
                    type="button"
                    className={`${seg.btn} ${tab === 'permissions' ? seg.btnActive : ''}`}
                    onClick={() => setTab('permissions')}
                  >
                    {t('settings.agent_tools_tab_workspace_permissions', '权限')}
                  </button>
                  <button
                    type="button"
                    className={`${seg.btn} ${tab === 'tools' ? seg.btnActive : ''}`}
                    onClick={() => setTab('tools')}
                  >
                    {t('settings.agent_tools_tab_workspace_tools', '工具')}
                  </button>
                </div>

                <div className={styles.workspacePicker}>
                  <label className={styles.workspaceLabel} htmlFor="workspace-gate-select">
                    {t('settings.workspace_policy_select', '工作区')}
                  </label>
                  <select
                    id="workspace-gate-select"
                    className={styles.workspaceSelect}
                    disabled={loadingWorkspaces || workspaces.length === 0}
                    value={workspaceId ?? ''}
                    onChange={(e) => setWorkspaceId(e.target.value || null)}
                  >
                    {workspaces.length === 0 ? (
                      <option value="">
                        {t('settings.workspace_policy_empty', '暂无已注册工作区')}
                      </option>
                    ) : (
                      workspaces.map((ws) => (
                        <option key={ws.id} value={ws.id}>
                          {ws.displayName}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className={styles.tabBody}>
            {!workspaceId ? (
              <div className={styles.scrollPane}>
                <p className={styles.emptyState}>
                  {loadingWorkspaces
                    ? t('common.loading', '加载中...')
                    : t(
                        'settings.workspace_policy_empty_hint',
                        '请先在工作台添加一个文件夹，再为该工作区单独配置权限与工具。'
                      )}
                </p>
              </div>
            ) : tab === 'permissions' ? (
              <div className={styles.scrollPane}>
                <BaishouAgentGateSettingsSection scene="workspace" scope={gateScope} />
              </div>
            ) : (
              <div className={styles.toolsPane}>
                <AgentToolsView
                  scene="workspace"
                  config={workspaceTools}
                  onChange={(config) => {
                    void handleWorkspaceToolsChange(config)
                  }}
                  onSubpageActiveChange={setToolsSubpageActive}
                />
              </div>
            )}
          </div>
        </div>
      </SettingsPageChrome>
    </div>
  )
}
