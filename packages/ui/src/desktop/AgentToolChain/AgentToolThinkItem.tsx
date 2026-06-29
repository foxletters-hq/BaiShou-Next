import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Think } from '@ant-design/x'
import { CloseCircleOutlined, ToolOutlined } from '@ant-design/icons'
import type { MockToolInvocation } from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { formatToolDurationMs, type AgentToolChainItemModel } from '../../shared/agent-tool-chain'
import { getToolDisplayName } from '../../shared/tool-result.util'
import { ToolResultContent } from './ToolResultContent'
import styles from './AgentToolChainSection.module.css'

export interface AgentToolThinkItemProps {
  model: AgentToolChainItemModel
  /** 流式进行中时自动展开 */
  autoExpand?: boolean
}

export const AgentToolThinkItem = React.memo(function AgentToolThinkItem({
  model,
  autoExpand = false
}: AgentToolThinkItemProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  /** 首次展开后保持挂载，以便 Think 收起时播放高度过渡动画 */
  const [contentMounted, setContentMounted] = useState(false)

  const isLoading = model.status === 'loading'
  const invocation = model.invocation as MockToolInvocation | undefined
  const hasContent = model.hasContent

  useEffect(() => {
    if (autoExpand) {
      setContentMounted(true)
      setExpanded(true)
    }
  }, [autoExpand])

  const displayTitle = useMemo(() => {
    if (invocation != null) {
      return getToolDisplayName(invocation, (key, fallback) => t(key, fallback))
    }
    return t(`agent.tools.${model.toolName}`, model.toolName)
  }, [invocation, model.toolName, t])

  const title = useMemo(
    () => (
      <span className={styles.titleRow}>
        <span className={styles.titleText}>{displayTitle}</span>
        {model.durationMs != null ? (
          <span className={styles.duration}>{formatToolDurationMs(model.durationMs)}</span>
        ) : null}
      </span>
    ),
    [displayTitle, model.durationMs]
  )

  const icon = useMemo(() => {
    if (model.status === 'error') {
      return <CloseCircleOutlined className={styles.errorIcon} />
    }
    return <ToolOutlined />
  }, [model.status])

  const handleExpand = useCallback((next: boolean) => {
    if (next) setContentMounted(true)
    setExpanded(next)
  }, [])

  const statusClassName = !hasContent ? styles.staticStatus : undefined

  return (
    <Think
      className={styles.toolThink}
      classNames={statusClassName ? { status: statusClassName } : undefined}
      title={title}
      icon={isLoading ? undefined : icon}
      loading={isLoading}
      blink={isLoading}
      expanded={hasContent ? expanded : false}
      onExpand={hasContent ? handleExpand : undefined}
    >
      {hasContent && invocation && contentMounted ? (
        <ToolResultContent invocation={invocation} />
      ) : null}
    </Think>
  )
})
