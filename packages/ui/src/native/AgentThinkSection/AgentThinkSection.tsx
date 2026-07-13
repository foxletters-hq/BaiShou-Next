import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useAgentThinkPresentation } from '../../shared/agent-think'
import { useNativeTheme } from '../theme'
import { AgentMarkdownRenderer } from '../AgentMarkdown'
import { CollapsibleHeight } from '../CollapsibleHeight'
import { ThinkChevron, ThinkStatusIcon } from './ThinkStatusIcon'

const COLLAPSE_DURATION_MS = 250

export interface AgentThinkSectionProps {
  content: string
  /** 标题左侧转圈；与 Markdown 渐显分离，避免落库后标题闪烁 */
  isLoading?: boolean
  /** @deprecated 请用 isLoading；保留兼容旧调用 */
  isStreaming?: boolean
  /** reasoning 正文是否走 Streamdown 渐显（默认 false，避免展开后闪烁） */
  isMarkdownStreaming?: boolean
}

/**
 * 对齐桌面 @ant-design/x Think：状态行 + 左侧竖线内容区。
 * 收起时先播高度动画，动画结束后再卸载正文，避免瞬间变空与卡顿。
 */
export function AgentThinkSection({
  content,
  isLoading,
  isStreaming = false,
  isMarkdownStreaming = false
}: AgentThinkSectionProps) {
  const { colors } = useNativeTheme()
  const body = content.trim()
  const loading = isLoading ?? isStreaming
  const { title, loading: showSpinner, expanded, setExpanded } = useAgentThinkPresentation(loading)
  const thinkExpanded = expanded
  const [keepBodyMounted, setKeepBodyMounted] = useState(thinkExpanded)

  useEffect(() => {
    if (thinkExpanded) {
      setKeepBodyMounted(true)
      return
    }
    const timer = setTimeout(() => setKeepBodyMounted(false), COLLAPSE_DURATION_MS)
    return () => clearTimeout(timer)
  }, [thinkExpanded])

  if (!thinkExpanded && !body && !loading) return null

  const showBody = Boolean(body) && (thinkExpanded || keepBodyMounted)
  const thinkBody = showBody ? (
    <AgentMarkdownRenderer content={body} variant="ancillary" isStreaming={isMarkdownStreaming} />
  ) : null

  const bodyChrome = (
    <View
      style={[
        styles.content,
        {
          borderLeftColor: colors.borderMuted,
          paddingTop: showBody ? 8 : 0
        }
      ]}
    >
      {thinkBody}
    </View>
  )

  return (
    <View style={styles.root}>
      <Pressable
        style={styles.statusRow}
        onPress={() => setExpanded(!expanded)}
        accessibilityRole="button"
        accessibilityState={{ expanded: thinkExpanded }}
      >
        <ThinkStatusIcon loading={showSpinner} color={colors.textSecondary} />
        <Text style={[styles.statusText, { color: colors.textSecondary }]} numberOfLines={1}>
          {title}
        </Text>
        <ThinkChevron expanded={thinkExpanded} color={colors.textTertiary} />
      </Pressable>

      {isMarkdownStreaming ? (
        thinkExpanded ? bodyChrome : null
      ) : (
        <CollapsibleHeight
          expanded={thinkExpanded}
          animation="ease"
          durationMs={COLLAPSE_DURATION_MS}
        >
          {bodyChrome}
        </CollapsibleHeight>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    width: '100%'
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    width: '100%'
  },
  statusText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400'
  },
  content: {
    width: '100%',
    paddingLeft: 12,
    borderLeftWidth: 2,
    overflow: 'hidden'
  }
})
