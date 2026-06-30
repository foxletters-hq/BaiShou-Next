import React, { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated'
import { useAgentThinkPresentation } from '../../shared/agent-think'
import { useNativeTheme } from '../theme'
import { AgentMarkdownRenderer } from '../AgentMarkdown'
import { CollapsibleHeight } from '../CollapsibleHeight'
import { ThinkChevron, ThinkStatusIcon } from './ThinkStatusIcon'

export interface AgentThinkSectionProps {
  content: string
  /** 状态行：标题闪烁、流式期间自动展开 */
  isStreaming?: boolean
  /** reasoning 正文是否走 Streamdown 渐显（可与正文流式重叠） */
  isMarkdownStreaming?: boolean
}

const AnimatedText = Animated.createAnimatedComponent(Text)

/**
 * 对齐桌面 @ant-design/x Think：状态行 + 左侧竖线内容区。
 * reasoning 直接渲染，不包 think 标签。
 */
export function AgentThinkSection({
  content,
  isStreaming = false,
  isMarkdownStreaming
}: AgentThinkSectionProps) {
  const { colors } = useNativeTheme()
  const body = content.trim()
  const { title, loading, expanded, setExpanded } = useAgentThinkPresentation(isStreaming)
  const blinkOpacity = useSharedValue(1)

  const markdownStreaming = isMarkdownStreaming ?? isStreaming
  const thinkExpanded = expanded

  useEffect(() => {
    if (!isStreaming) {
      blinkOpacity.value = 1
      return
    }

    blinkOpacity.value = withRepeat(
      withSequence(
        withTiming(0.45, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    )
  }, [blinkOpacity, isStreaming])

  const titleBlinkStyle = useAnimatedStyle(() => ({
    opacity: isStreaming ? blinkOpacity.value : 1
  }))

  if (!thinkExpanded && !body && !isStreaming) return null

  const thinkBody = body ? (
    <AgentMarkdownRenderer content={body} variant="ancillary" isStreaming={markdownStreaming} />
  ) : null
  const visibleThinkBody = thinkExpanded ? thinkBody : null

  return (
    <View style={styles.root}>
      <Pressable
        style={styles.statusRow}
        onPress={() => setExpanded(!expanded)}
        accessibilityRole="button"
        accessibilityState={{ expanded: thinkExpanded }}
      >
        <ThinkStatusIcon loading={loading} color={colors.textSecondary} />
        <AnimatedText
          style={[
            styles.statusText,
            { color: colors.textSecondary },
            isStreaming ? titleBlinkStyle : null
          ]}
          numberOfLines={1}
        >
          {title}
        </AnimatedText>
        <ThinkChevron expanded={thinkExpanded} color={colors.textTertiary} />
      </Pressable>

      {markdownStreaming && thinkExpanded ? (
        <View
          style={[
            styles.content,
            {
              borderLeftColor: colors.borderMuted,
              paddingTop: 8
            }
          ]}
        >
          {visibleThinkBody}
        </View>
      ) : (
        <CollapsibleHeight expanded={thinkExpanded} animation="ease" durationMs={250}>
          <View
            style={[
              styles.content,
              {
                borderLeftColor: colors.borderMuted,
                paddingTop: 8
              }
            ]}
          >
            {visibleThinkBody}
          </View>
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
    alignSelf: 'flex-start',
    maxWidth: '100%'
  },
  statusText: {
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
