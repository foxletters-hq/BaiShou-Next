import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Wrench, X } from 'lucide-react'
import type { AgentToolsViewProps } from './agent-tools.types'
import { useAgentToolsView } from './useAgentToolsView'
import { AgentToolsBuiltInList } from './AgentToolsBuiltInList'
import { HelpTooltip } from '../HelpTooltip'
import styles from './AgentToolsView.module.css'

export type { ToolManagementConfig, AgentToolsViewProps } from './agent-tools.types'

export const AgentToolsView: React.FC<AgentToolsViewProps> = ({
  config,
  onChange,
  scene = 'companion',
  presentation = 'page',
  onClose,
  onSubpageActiveChange
}) => {
  const { t } = useTranslation()
  const view = useAgentToolsView({ config, onChange, scene })
  const isDialog = presentation === 'dialog'
  const containerClass = isDialog
    ? `${styles.container} ${styles.containerDialog}`
    : styles.container
  const headerClass = isDialog ? `${styles.header} ${styles.headerDialog}` : styles.header
  const scrollClass = isDialog
    ? `${styles.scrollArea} ${styles.scrollAreaDialog}`
    : styles.scrollArea

  useEffect(() => {
    onSubpageActiveChange?.(false)
    return () => onSubpageActiveChange?.(false)
  }, [onSubpageActiveChange])

  return (
    <div className={containerClass}>
      {isDialog ? (
        <div className={headerClass}>
          <div className={styles.headerMain}>
            <div className={styles.titleRow}>
              <span className={styles.titleIcon}>
                <Wrench size={20} />
              </span>
              <div className={styles.titleBlock}>
                <h3 className={styles.title}>{t('settings.agent_tools_title', '工具管理')}</h3>
                <HelpTooltip
                  size={14}
                  content={
                    scene === 'workspace'
                      ? t(
                          'settings.workspace_tools_desc',
                          '管理当前工作区可用的工具；与伙伴工具相互独立。'
                        )
                      : t('settings.agent_tools_desc', '管理伙伴可使用的工具，开关或配置工具参数')
                  }
                />
              </div>
            </div>
          </div>
          {onClose ? (
            <button
              type="button"
              className={styles.dialogCloseBtn}
              onClick={onClose}
              aria-label={t('common.close', '关闭')}
            >
              <X size={18} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className={scrollClass}>
        <AgentToolsBuiltInList
          config={config}
          categoryMeta={view.categoryMeta}
          categoryOrder={view.categoryOrder}
          groupedTools={view.groupedTools}
          onToggleTool={view.toggleTool}
          getToolParam={view.getToolParam}
          setToolParam={view.setToolParam}
          onConfigChange={onChange}
          showEmojiTools={view.showEmojiTools}
        />
      </div>
    </div>
  )
}
