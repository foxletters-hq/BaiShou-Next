import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { formatToolDurationMs, type AgentToolChainItemModel } from '../../shared/agent-tool-chain'
import { getToolDisplayName, type ToolInvocationLike } from '../../shared/tool-result.util'
import { ThinkChevron, ToolStatusIcon } from '../AgentThinkSection/ThinkStatusIcon'
import { CollapsibleHeight } from '../CollapsibleHeight'
import { useNativeTheme } from '../theme'
import { ToolResultContent } from './ToolResultContent'

const AnimatedText = Animated.createAnimatedComponent(Text)

export interface AgentToolThinkItemProps {
  model: AgentToolChainItemModel
  autoExpand?: boolean
}

export const AgentToolThinkItem = React.memo(function AgentToolThinkItem({
  model,
  autoExpand = false
}: AgentToolThinkItemProps) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [expanded, setExpanded] = useState(false)
  const [contentMounted, setContentMounted] = useState(false)

  const isLoading = model.status === 'loading'
  const invocation = model.invocation as ToolInvocationLike | undefined
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

  const blinkOpacity = useSharedValue(1)
  useEffect(() => {
    if (!isLoading) {
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
  }, [blinkOpacity, isLoading])

  const titleBlinkStyle = useAnimatedStyle(() => ({
    opacity: isLoading ? blinkOpacity.value : 1
  }))

  const handleToggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev
      if (next) setContentMounted(true)
      return next
    })
  }, [])

  return (
    <View style={styles.root}>
      <Pressable
        style={styles.statusRow}
        onPress={hasContent ? handleToggle : undefined}
        disabled={!hasContent}
        accessibilityRole="button"
        accessibilityState={{ expanded: hasContent ? expanded : undefined }}
      >
        <ToolStatusIcon
          loading={isLoading}
          status={model.status}
          color={colors.textSecondary}
          errorColor={colors.error}
        />
        <AnimatedText
          style={[
            styles.statusText,
            { color: colors.textSecondary },
            isLoading ? titleBlinkStyle : null
          ]}
          numberOfLines={2}
        >
          {displayTitle}
        </AnimatedText>
        {model.durationMs != null ? (
          <Text style={[styles.duration, { color: colors.textTertiary }]}>
            {formatToolDurationMs(model.durationMs)}
          </Text>
        ) : null}
        {hasContent ? <ThinkChevron expanded={expanded} color={colors.textTertiary} /> : null}
      </Pressable>

      {hasContent && invocation && contentMounted ? (
        <CollapsibleHeight expanded={expanded} animation="ease" durationMs={250}>
          <View
            style={[
              styles.content,
              {
                borderLeftColor: colors.borderMuted,
                paddingTop: 8
              }
            ]}
          >
            <ToolResultContent invocation={invocation} />
          </View>
        </CollapsibleHeight>
      ) : null}
    </View>
  )
})

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
  duration: {
    fontSize: 11,
    fontVariant: ['tabular-nums']
  },
  content: {
    width: '100%',
    paddingLeft: 12,
    borderLeftWidth: 2
  }
})
