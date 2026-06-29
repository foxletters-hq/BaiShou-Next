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
  isStreaming?: boolean
}

const AnimatedText = Animated.createAnimatedComponent(Text)

/**
 * 对齐桌面 @ant-design/x Think：状态行 + 左侧竖线内容区。
 * reasoning 直接渲染，不包 think 标签。
 */
export const AgentThinkSection: React.FC<AgentThinkSectionProps> = ({
  content,
  isStreaming = false
}) => {
  const { colors } = useNativeTheme()
  const body = content.trim()
  const { title, loading, expanded, setExpanded } = useAgentThinkPresentation(isStreaming)
  const blinkOpacity = useSharedValue(1)

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

  if (!isStreaming && !body) return null

  return (
    <View style={styles.root}>
      <Pressable
        style={styles.statusRow}
        onPress={() => setExpanded(!expanded)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
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
        <ThinkChevron expanded={expanded} color={colors.textTertiary} />
      </Pressable>

      <CollapsibleHeight expanded={expanded} animation="ease" durationMs={250}>
        <View
          style={[
            styles.content,
            {
              borderLeftColor: colors.borderMuted,
              marginTop: expanded ? 8 : 0
            }
          ]}
        >
          {body ? (
            <AgentMarkdownRenderer content={body} variant="ancillary" isStreaming={isStreaming} />
          ) : null}
        </View>
      </CollapsibleHeight>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    marginBottom: 8
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
    borderLeftWidth: 2
  }
})
