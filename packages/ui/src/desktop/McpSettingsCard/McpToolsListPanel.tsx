import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './McpToolsListPanel.module.css'

export interface McpToolInfo {
  name: string
  displayName?: string
  description?: string
  category?: string
}

export const McpToolsListPanel: React.FC = () => {
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
        const cleanName = tool.displayName || tool.name.replace(/^baishou_/, '')
        const localizedTitle = t(`agent.tools.${cleanName}`, cleanName) as string
        const localizedDesc = t(`agent.tools.${cleanName}_desc`, tool.description ?? '') as string

        return (
          <article key={tool.name} className={styles.toolItem}>
            <div className={styles.toolHeader}>
              <span className={styles.toolName}>{tool.name}</span>
              <span className={styles.toolCategory}>{tool.category || 'general'}</span>
              <span className={styles.toolTitle}>({localizedTitle})</span>
            </div>
            {localizedDesc ? <p className={styles.toolDescription}>{localizedDesc}</p> : null}
          </article>
        )
      })}
    </div>
  )
}
