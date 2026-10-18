import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Switch } from '../Switch/Switch'
import type { McpServerConfig } from '@baishou/shared'
import styles from './McpToolsListPanel.module.css'

export interface McpToolInfo {
  name: string
  toolId?: string
  displayName?: string
  description?: string
  category?: string
  enabled?: boolean
}

export interface McpToolsListPanelProps {
  config?: McpServerConfig
  onChange?: (config: McpServerConfig) => void
}

export const McpToolsListPanel: React.FC<McpToolsListPanelProps> = ({ config, onChange }) => {
  const { t } = useTranslation()
  const [tools, setTools] = useState<McpToolInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadTools = async () => {
      setLoading(true)
      setFailed(false)
      try {
        const result = await (window as any).api?.settings?.getMcpTools()
        if (cancelled) return
        setTools(Array.isArray(result) ? result : [])
      } catch (e) {
        console.warn('[McpToolsListPanel] Failed to load MCP tools', e)
        if (!cancelled) {
          setFailed(true)
          setTools([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadTools()
    return () => {
      cancelled = true
    }
  }, [])

  const isToolEnabled = (tool: McpToolInfo): boolean => {
    const rawId = tool.toolId || tool.name.replace(/^baishou_/, '')
    if (config?.disabledToolIds) {
      return !config.disabledToolIds.includes(rawId) && !config.disabledToolIds.includes(tool.name)
    }
    return tool.enabled !== false
  }

  const handleToggle = (tool: McpToolInfo, currentEnabled: boolean) => {
    if (!config || !onChange) return
    const rawId = tool.toolId || tool.name.replace(/^baishou_/, '')
    const currentDisabled = config.disabledToolIds || []
    let nextDisabled: string[]

    if (currentEnabled) {
      nextDisabled = Array.from(new Set([...currentDisabled, rawId]))
    } else {
      nextDisabled = currentDisabled.filter((id) => id !== rawId && id !== tool.name)
    }

    onChange({
      ...config,
      disabledToolIds: nextDisabled
    })
  }

  if (loading) {
    return <p className={styles.stateMessage}>{t('common.loading', '加载中...')}</p>
  }

  if (failed) {
    return (
      <p className={styles.stateMessage}>
        {t('settings.mcp_tools_fetch_failed', '获取工具列表失败')}
      </p>
    )
  }

  if (tools.length === 0) {
    return (
      <p className={styles.stateMessage}>{t('settings.mcp_no_tools', '未检测到任何暴露的工具')}</p>
    )
  }

  return (
    <div className={styles.toolsList}>
      {tools.map((tool) => {
        const rawId = tool.toolId || tool.name.replace(/^baishou_/, '')
        const fallbackTitle =
          tool.displayName && tool.displayName !== rawId ? tool.displayName : rawId
        const localizedTitle = t(`agent.tools.${rawId}`, fallbackTitle) as string
        const localizedDesc = t(
          `agent.tools.${rawId}_desc`,
          t(`agent.tools.${rawId}_tooltip`, tool.description ?? '')
        ) as string
        const categoryKey = tool.category || 'general'
        const localizedCategory = t(
          `settings.agent_tools_category_${categoryKey}`,
          categoryKey
        ) as string
        const enabled = isToolEnabled(tool)

        return (
          <article
            key={tool.name}
            className={`${styles.toolItem} ${enabled ? '' : styles.toolItemDisabled}`}
          >
            <div className={styles.toolItemMain}>
              <div className={styles.toolInfo}>
                <div className={styles.toolHeader}>
                  <span className={styles.toolName}>{tool.name}</span>
                  <span className={styles.toolCategory}>{localizedCategory}</span>
                  <span className={styles.toolTitle}>({localizedTitle})</span>
                </div>
                {localizedDesc ? <p className={styles.toolDescription}>{localizedDesc}</p> : null}
              </div>
              {onChange && config ? (
                <div className={styles.toolAction}>
                  <Switch
                    checked={enabled}
                    aria-label={t('settings.mcp_tool_toggle', '开关 {{name}}', {
                      name: localizedTitle
                    })}
                    onChange={() => handleToggle(tool, enabled)}
                  />
                </div>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
