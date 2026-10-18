import React, { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { Briefcase, Heart } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { getAssistantKindHintKey, type AssistantKind } from '@baishou/shared'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export interface AssistantKindTabBarProps {
  activeKind: AssistantKind
  onKindChange: (kind: AssistantKind) => void
}

const TAB_PADDING = sharedTokens.spacing.xsPlus
const TAB_GAP = sharedTokens.spacing.sm

const TAB_SPRING_CONFIG = {
  damping: 20,
  stiffness: 220,
  mass: 0.6
}

export const AssistantKindTabBar: React.FC<AssistantKindTabBarProps> = ({
  activeKind,
  onKindChange
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const slideAnim = useSharedValue(0)
  const hasMeasuredIndicatorRef = useRef(false)
  const [layoutWidth, setLayoutWidth] = useState(0)

  const tabWidth = layoutWidth > 0 ? (layoutWidth - TAB_PADDING * 2 - TAB_GAP) / 2 : 0
  const showFallbackBg = tabWidth <= 0

  useEffect(() => {
    if (tabWidth <= 0) return
    const next = activeKind === 'work' ? 1 : 0
    if (!hasMeasuredIndicatorRef.current) {
      slideAnim.value = next
      hasMeasuredIndicatorRef.current = true
      return
    }
    slideAnim.value = withSpring(next, TAB_SPRING_CONFIG)
  }, [activeKind, slideAnim, tabWidth])

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideAnim.value * (tabWidth + TAB_GAP) }],
    width: tabWidth
  }))

  return (
    <View style={styles.section}>
      <View
        style={[
          styles.wrap,
          {
            backgroundColor: colors.bgSurfaceNormal,
            borderColor: colors.borderControl
          }
        ]}
        onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
      >
        {tabWidth > 0 ? (
          <Animated.View
            style={[styles.indicator, { backgroundColor: colors.bgSurface }, indicatorStyle]}
          />
        ) : null}
        <Pressable
          style={[
            styles.tab,
            activeKind === 'companion' && showFallbackBg
              ? { backgroundColor: colors.bgSurface }
              : null
          ]}
          onPress={() => onKindChange('companion')}
        >
          <Heart
            size={18}
            color={activeKind === 'companion' ? colors.primary : colors.textSecondary}
            strokeWidth={DEFAULT_STROKE_WIDTH}
            fill={activeKind === 'companion' ? colors.primary : 'transparent'}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeKind === 'companion' ? colors.primary : colors.textSecondary }
            ]}
          >
            {t('agent.assistant.kind_companion')}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.tab,
            activeKind === 'work' && showFallbackBg ? { backgroundColor: colors.bgSurface } : null
          ]}
          onPress={() => onKindChange('work')}
        >
          <Briefcase
            size={18}
            color={activeKind === 'work' ? colors.primary : colors.textSecondary}
            strokeWidth={DEFAULT_STROKE_WIDTH}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeKind === 'work' ? colors.primary : colors.textSecondary }
            ]}
          >
            {t('agent.assistant.kind_work')}
          </Text>
        </Pressable>
      </View>
      <Animated.Text
        key={activeKind}
        entering={FadeIn.duration(sharedTokens.animation.swift)}
        style={[styles.hint, { color: colors.textSecondary }]}
      >
        {t(getAssistantKindHintKey(activeKind))}
      </Animated.Text>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    alignSelf: 'stretch',
    width: '100%'
  },
  wrap: {
    flexDirection: 'row',
    gap: TAB_GAP,
    padding: TAB_PADDING,
    borderRadius: sharedTokens.radius.control,
    borderWidth: 1,
    alignSelf: 'stretch',
    width: '100%',
    overflow: 'hidden'
  },
  indicator: {
    position: 'absolute',
    top: TAB_PADDING,
    bottom: TAB_PADDING,
    left: TAB_PADDING,
    borderRadius: sharedTokens.radius.sm
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm,
    minWidth: 0
  },
  tabText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    flexShrink: 1
  },
  hint: {
    marginTop: sharedTokens.spacing.sm,
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 18
  }
})
