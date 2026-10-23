import React, { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import type { AssistantDisplayCompletedTool, AssistantDisplayTimelineItem } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { AgentMarkdownRenderer } from '../AgentMarkdown'
import { AgentToolChainSection } from '../AgentToolChain'
import { CollapsibleHeight } from '../CollapsibleHeight'
import { ThinkChevron, ThinkStatusIcon } from '../AgentThinkSection/ThinkStatusIcon'
import { useAgentProcessPresentation } from '../../shared/agent-process'
import { markdownSpacingTokens, mobileTypography, sharedTokens } from '../../theme/tokens'
import type { ToolInvocationLike } from '../../shared/tool-result.util'
import type { AgentToolChainStreamingTool } from '../../shared/agent-tool-chain'

export interface AgentProcessSectionProps {
  /** 思考正文 */
  reasoningContent?: string
  /** 思考是否仍在流式渲染 */
  isReasoningStreaming?: boolean
  /** 思考标题是否在转圈 */
  isReasoningLoading?: boolean
  /** 来自 timeline 的多个工具链项 */
  toolsItems?: Array<Extract<AssistantDisplayTimelineItem, { kind: 'tools' }>>
  /** 直接传入的 invocations（非 timeline 场景） */
  invocations?: ToolInvocationLike[]
  /** 直接传入的流式完成工具（非 timeline 场景） */
  streamingCompletedTools?: AgentToolChainStreamingTool[]
  /** 当前活动工具名（流式中） */
  activeToolName?: string | null
  activeToolArgs?: unknown
  /** 是否流式中 */
  isStreaming?: boolean
  /** 是否已有最终正文（关键判定：已有正文时默认收起） */
  hasAnswerText?: boolean
  /** 前方是否有正文（在正文后执行工具时，适当加大与上方最后一个文字的间距） */
  hasPrecedingText?: boolean
  /** 强制指定默认展开 */
  defaultExpanded?: boolean
  /** 自定义展开内容（若传入则优先使用 children 渲染展开区域） */
  children?: React.ReactNode
  /** 自定义根容器样式 */
  style?: StyleProp<ViewStyle>
}

export function AgentProcessSection({
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
  hasPrecedingText = false,
  defaultExpanded,
  children,
  style
}: AgentProcessSectionProps) {
  const { colors } = useNativeTheme()

  const cleanReasoning = reasoningContent?.trim() || ''
  const hasReasoning = Boolean(cleanReasoning)

  // 统计工具总量与耗时
  const {
    allInvocations,
    allCompletedTools,
    totalDurationMs,
    completedCount,
    currentActiveToolName,
    currentActiveToolArgs
  } = useMemo(() => {
    if (toolsItems && toolsItems.length > 0) {
      const invs: ToolInvocationLike[] = []
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

  const {
    title,
    loading: showSpinner,
    expanded,
    setExpanded
  } = useAgentProcessPresentation({
    hasReasoning,
    completedToolsCount: completedCount,
    totalDurationMs,
    isStreaming,
    hasAnswerText,
    activeToolName: currentActiveToolName,
    isThinkLoading: isReasoningLoading,
    defaultExpanded
  })

  // 如果既没有思考内容又没有工具，也没有在加载或自定义子内容，直接不渲染
  if (!hasReasoning && !hasTools && !showSpinner && !children) {
    return null
  }

  return (
    <View style={[styles.root, hasPrecedingText ? styles.rootWithPrecedingText : null, style]}>
      <Pressable
        style={styles.statusRow}
        onPress={() => setExpanded(!expanded)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <ThinkStatusIcon loading={showSpinner} color={colors.textSecondary} />
        <Text style={[styles.statusText, { color: colors.textSecondary }]} numberOfLines={1}>
          {title}
        </Text>
        <ThinkChevron expanded={expanded} color={colors.textTertiary} />
      </Pressable>

      <CollapsibleHeight expanded={expanded} animation="ease" durationMs={250}>
        <View
          style={[
            styles.content,
            {
              borderLeftColor: colors.borderMuted
            }
          ]}
        >
          {children ? (
            children
          ) : (
            <>
              {hasReasoning ? (
                <View style={styles.reasoningSlot}>
                  <AgentMarkdownRenderer
                    content={cleanReasoning}
                    variant="ancillary"
                    isStreaming={isReasoningStreaming}
                  />
                </View>
              ) : null}

              {hasTools ? (
                <View
                  style={[styles.toolsSlot, hasReasoning ? styles.toolsSlotWithReasoning : null]}
                >
                  <AgentToolChainSection
                    invocations={allInvocations}
                    completedTools={allCompletedTools}
                    activeToolName={currentActiveToolName}
                    activeToolArgs={currentActiveToolArgs}
                    isStreaming={Boolean(isStreaming && currentActiveToolName)}
                  />
                </View>
              ) : null}
            </>
          )}
        </View>
      </CollapsibleHeight>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    width: '100%'
  },
  rootWithPrecedingText: {
    marginTop: markdownSpacingTokens.processAfterTextMarginTop
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 24,
    paddingVertical: sharedTokens.spacing.xxs
  },
  statusText: {
    flex: 1,
    flexShrink: 1,
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 22,
    fontWeight: '400'
  },
  content: {
    width: '100%',
    paddingLeft: sharedTokens.spacing.mdTight,
    borderLeftWidth: 2,
    paddingTop: sharedTokens.spacing.xsPlus,
    paddingBottom: sharedTokens.spacing.xs
  },
  reasoningSlot: {
    width: '100%'
  },
  toolsSlot: {
    width: '100%'
  },
  toolsSlotWithReasoning: {
    marginTop: sharedTokens.spacing.sm
  }
})
