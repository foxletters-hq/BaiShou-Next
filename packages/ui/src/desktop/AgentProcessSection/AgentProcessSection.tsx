import React, { useMemo } from 'react'
import { Think, XProvider } from '@ant-design/x'
import { theme } from 'antd'
import type {
  AssistantDisplayCompletedTool,
  AssistantDisplayTimelineItem,
  MockToolInvocation
} from '@baishou/shared'
import { useTheme } from '../../hooks/useTheme'
import { useAgentProcessPresentation } from '../../shared/agent-process'
import type { AgentToolChainStreamingTool } from '../../shared/agent-tool-chain'
import { AgentMarkdownRenderer } from '../AgentMarkdown/AgentMarkdownRenderer'
import { AgentToolChainSection } from '../AgentToolChain'
import styles from '../AgentMarkdown/AgentThinkBlock.module.css'

export interface AgentProcessSectionProps {
  reasoningContent?: string
  isReasoningStreaming?: boolean
  isReasoningLoading?: boolean
  toolsItems?: Array<Extract<AssistantDisplayTimelineItem, { kind: 'tools' }>>
  invocations?: MockToolInvocation[]
  streamingCompletedTools?: AgentToolChainStreamingTool[]
  activeToolName?: string | null
  activeToolArgs?: unknown
  isStreaming?: boolean
  hasAnswerText?: boolean
  hasPrecedingText?: boolean
  defaultExpanded?: boolean
  children?: React.ReactNode
}

export const AgentProcessSection: React.FC<AgentProcessSectionProps> = ({
  reasoningContent,
  isReasoningStreaming = false,
  isReasoningLoading = false,
  toolsItems,
  invocations = [],
  streamingCompletedTools = [],
  activeToolName = null,
  activeToolArgs,
  isStreaming = false,
  hasAnswerText = false,
  defaultExpanded,
  children
}) => {
  const { isDark } = useTheme()
  const cleanReasoning = reasoningContent?.trim() || ''
  const hasReasoning = Boolean(cleanReasoning)

  const {
    allInvocations,
    allCompletedTools,
    totalDurationMs,
    completedCount,
    currentActiveToolName,
    currentActiveToolArgs
  } = useMemo(() => {
    if (toolsItems && toolsItems.length > 0) {
      const invs: MockToolInvocation[] = []
      const completed: AssistantDisplayCompletedTool[] = []
      let duration = 0
      let activeName: string | null = null
      let activeArgs: unknown = undefined

      for (const t of toolsItems) {
        if (t.invocations) invs.push(...t.invocations)
        if (t.completedTools) {
          completed.push(...t.completedTools)
          for (const c of t.completedTools) {
            duration += c.durationMs || 0
          }
        }
        if (t.activeToolName) {
          activeName = t.activeToolName
          activeArgs = t.activeToolArgs
        }
      }

      return {
        allInvocations: invs,
        allCompletedTools: completed as AgentToolChainStreamingTool[],
        totalDurationMs: duration,
        completedCount: completed.length || invs.length,
        currentActiveToolName: activeName ?? activeToolName,
        currentActiveToolArgs: activeArgs ?? activeToolArgs
      }
    }

    let duration = 0
    for (const c of streamingCompletedTools) {
      duration += c.durationMs || 0
    }
    const count = streamingCompletedTools.length || invocations.length

    return {
      allInvocations: invocations,
      allCompletedTools: streamingCompletedTools,
      totalDurationMs: duration,
      completedCount: count,
      currentActiveToolName: activeToolName,
      currentActiveToolArgs: activeToolArgs
    }
  }, [toolsItems, invocations, streamingCompletedTools, activeToolName, activeToolArgs])

  const hasTools = completedCount > 0 || Boolean(currentActiveToolName)

  const { title, loading, expanded, setExpanded } = useAgentProcessPresentation({
    hasReasoning,
    completedToolsCount: completedCount,
    totalDurationMs,
    isStreaming,
    hasAnswerText,
    activeToolName: currentActiveToolName,
    isThinkLoading: isReasoningLoading,
    defaultExpanded
  })

  const xProviderTheme = useMemo(
    () => ({
      algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        fontFamily: 'var(--font-family)',
        fontFamilyCode: 'var(--font-family-mono)',
        colorText: 'var(--text-secondary)',
        colorTextSecondary: 'var(--text-secondary)',
        colorTextTertiary: 'var(--text-tertiary)',
        colorTextDescription: 'var(--text-secondary)'
      }
    }),
    [isDark]
  )

  if (!hasReasoning && !hasTools && !loading && !children) {
    return null
  }

  return (
    <XProvider theme={xProviderTheme}>
      <Think
        className={styles.root}
        title={title}
        loading={loading}
        expanded={expanded}
        blink={loading}
        onExpand={setExpanded}
      >
        {children ? (
          children
        ) : (
          <>
            {hasReasoning ? (
              <AgentMarkdownRenderer
                content={cleanReasoning}
                variant="ancillary"
                isStreaming={isReasoningStreaming}
                wrapXProvider={false}
              />
            ) : null}
            {hasTools ? (
              <AgentToolChainSection
                invocations={allInvocations}
                completedTools={allCompletedTools}
                activeToolName={currentActiveToolName}
                activeToolArgs={currentActiveToolArgs}
                isStreaming={Boolean(isStreaming && currentActiveToolName)}
              />
            ) : null}
          </>
        )}
      </Think>
    </XProvider>
  )
}
