import React, { useEffect } from 'react'
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '@baishou/ui/native'

interface SummaryTabBarProps {
  activeTab: 'panel' | 'gallery'
  onTabChange: (tab: 'panel' | 'gallery') => void
}

const TAB_PADDING = 6
const TAB_GAP = 8

export const SummaryTabBar: React.FC<SummaryTabBarProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { width: screenWidth } = useWindowDimensions()
  const slideAnim = useSharedValue(0)

  const tabsContainerWidth = screenWidth - 24
  const tabWidth = (tabsContainerWidth - TAB_PADDING * 2 - TAB_GAP) / 2

  useEffect(() => {
    slideAnim.value = withTiming(activeTab === 'gallery' ? 1 : 0, { duration: 280 })
  }, [activeTab, slideAnim])

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideAnim.value * (tabWidth + TAB_GAP) }]
  }))

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.bgGlassSurface ?? colors.bgSurface,
          borderBottomColor: colors.borderMuted
        }
      ]}
    >
      <View style={[styles.tabs, { backgroundColor: colors.bgSurfaceNormal }]}>
        <Animated.View
          style={[
            styles.indicator,
            { width: tabWidth, backgroundColor: colors.bgSurface },
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
        <Pressable style={styles.tab} onPress={() => onTabChange('panel')}>
          <MaterialIcons
            name="dashboard"
            size={18}
            color={activeTab === 'panel' ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'panel' ? colors.primary : colors.textSecondary }
            ]}
          >
            {t('summary.panel_tab')}
          </Text>
        </Pressable>
        <Pressable style={styles.tab} onPress={() => onTabChange('gallery')}>
          <MaterialIcons
            name="layers"
            size={18}
            color={activeTab === 'gallery' ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'gallery' ? colors.primary : colors.textSecondary }
            ]}
          >
            {t('summary.memory_gallery')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  tabs: {
    flexDirection: 'row',
    gap: TAB_GAP,
    padding: TAB_PADDING,
    borderRadius: 12,
    alignSelf: 'stretch',
    width: '100%'
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
    paddingHorizontal: 12,
    borderRadius: 8
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700'
  }
})
