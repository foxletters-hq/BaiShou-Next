import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings, X } from 'lucide-react'
import { AgentToolsView, Modal, SegmentedControl, type AgentToolsConfig } from '@baishou/ui'
import {
  DEFAULT_WORKSPACE_TOOL_MANAGEMENT_CONFIG,
  type WorkspaceToolManagementConfig
} from '@baishou/shared'
import { BaishouAgentGateSettingsSection } from '../../settings/components/BaishouAgentGateSettingsSection'
import styles from './WorkbenchWorkspaceGateSheet.module.css'

export interface WorkbenchWorkspaceGateSheetProps {
  open: boolean
  workspaceId: string
  workspaceName: string
  onClose: () => void
}

type WorkbenchSettingsTab = 'permissions' | 'tools'

/** 工作台设置：全局 Agent 安全模式与工具（居中弹窗） */
export const WorkbenchWorkspaceGateSheet: React.FC<WorkbenchWorkspaceGateSheetProps> = ({
  open,
  workspaceId,
  workspaceName,
  onClose
}) => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<WorkbenchSettingsTab>('permissions')
  const [toolsSubpageActive, setToolsSubpageActive] = useState(false)
  const [permissionsSubpageActive, setPermissionsSubpageActive] = useState(false)
  const [workspaceTools, setWorkspaceTools] = useState<WorkspaceToolManagementConfig>(
    DEFAULT_WORKSPACE_TOOL_MANAGEMENT_CONFIG
  )

  const subpageActive = toolsSubpageActive || permissionsSubpageActive

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // 权限/工具子页由子组件先处理返回；此处勿关弹窗
      if (toolsSubpageActive || permissionsSubpageActive) return
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, toolsSubpageActive, permissionsSubpageActive])

  useEffect(() => {
    if (!open) {
      setTab('permissions')
      setToolsSubpageActive(false)
      setPermissionsSubpageActive(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void window.api.settings
      .getWorkspaceToolManagement(workspaceId)
      .then((config) => {
        if (!cancelled) setWorkspaceTools(config)
      })
      .catch((error) => {
        console.error('[WorkbenchWorkspaceGateSheet] load tools failed:', error)
        if (!cancelled) setWorkspaceTools(DEFAULT_WORKSPACE_TOOL_MANAGEMENT_CONFIG)
      })
    return () => {
      cancelled = true
    }
  }, [open, workspaceId])

  const handleWorkspaceToolsChange = async (config: AgentToolsConfig) => {
    const next: WorkspaceToolManagementConfig = {
      disabledToolIds: config.disabledToolIds ?? [],
      customConfigs: (config.customConfigs ?? {}) as Record<string, Record<string, unknown>>
    }
    setWorkspaceTools(next)
    try {
      const saved = await window.api.settings.setWorkspaceToolManagement(workspaceId, next)
      setWorkspaceTools(saved)
    } catch (error) {
      console.error('[WorkbenchWorkspaceGateSheet] save tools failed:', error)
    }
  }

  const title = t('workbench.settings_title', '工作台设置')

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      closeOnOverlayClick
      zIndex={1200}
      overlayClassName={styles.overlay}
      className={styles.modal}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <Settings size={16} aria-hidden />
          <h2 className={styles.title}>{title}</h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label={t('common.close', '关闭')}
          >
            <X size={16} />
          </button>
        </header>

        {subpageActive ? null : (
          <div className={styles.tabs}>
            <SegmentedControl
              value={tab}
              options={[
                {
                  value: 'permissions',
                  label: t('settings.agent_tools_tab_workspace_permissions', '权限')
                },
                {
                  value: 'tools',
                  label: t('settings.agent_tools_tab_workspace_tools', '工具')
                }
              ]}
              onChange={setTab}
            />
          </div>
        )}

        <div className={tab === 'tools' ? styles.toolsBody : styles.body}>
          {tab === 'permissions' ? (
            <BaishouAgentGateSettingsSection
              key={workspaceId}
              scene="workspace"
              scope={{ kind: 'workspace', workspaceId }}
              onSubpageActiveChange={setPermissionsSubpageActive}
            />
          ) : (
            <AgentToolsView
              scene="workspace"
              config={workspaceTools}
              onChange={(config) => {
                void handleWorkspaceToolsChange(config)
              }}
              onSubpageActiveChange={setToolsSubpageActive}
            />
          )}
        </div>
      </div>
    </Modal>
  )
}
