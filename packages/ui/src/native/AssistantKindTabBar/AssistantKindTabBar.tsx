import React, { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'
import { getAssistantKindHintKey, type AssistantKind } from '@baishou/shared'

export interface AssistantKindTabBarProps {
  activeKind: AssistantKind
  onKindChange: (kind: AssistantKind) => void
}

const TAB_PADDING = 6
const TAB_GAP = 8

export const AssistantKindTabBar: React.FC<AssistantKindTabBarProps> = ({
  activeKind,
  onKindChange
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const slideAnim = useSharedValue(0)
  const [layoutWidth, setLayoutWidth] = useState(0)

  const tabWidth =
    layoutWidth > 0 ? (layoutWidth - TAB_PADDING * 2 - TAB_GAP) / 2 : 0

  useEffect(() => {
    if (tabWidth <= 0) return
    slideAnim.value = withTiming(activeKind === 'work' ? 1 : 0, { duration: 280 })
  }, [activeKind, slideAnim, tabWidth])

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideAnim.value * (tabWidth + TAB_GAP) }],
    width: tabWidth
  }))

  return (
    <View style={styles.section}>
      <View
        style={[styles.wrap, { backgroundColor: colors.bgSurfaceNormal }]}
        onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
      >
        {tabWidth > 0 ? (
          <Animated.View
            style={[
              styles.indicator,
              { backgroundColor: colors.bgSurface },
              indicatorStyle,
              {
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 1 },
                elevation: 2
              }
            ]}
          />
        ) : null}
        <Pressable style={styles.tab} onPress={() => onKindChange('companion')}>
          <MaterialIcons
            name="favorite"
            size={18}
            color={activeKind === 'companion' ? colors.primary : colors.textSecondary}
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
        <Pressable style={styles.tab} onPress={() => onKindChange('work')}>
          <MaterialIcons
            name="work"
            size={18}
            color={activeKind === 'work' ? colors.primary : colors.textSecondary}
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
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {t(getAssistantKindHintKey(activeKind))}
      </Text>
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
    borderRadius: 12,
    alignSelf: 'stretch',
    width: '100%',
    overflow: 'hidden'
  },
  indicator: {
    position: 'absolute',
    top: TAB_PADDING,
    bottom: TAB_PADDING,
    left: TAB_PADDING,
    borderRadius: 8
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    minWidth: 0
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1
  },
  hint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18
  }
})
