import { Tabs } from 'expo-router'
import React, { useMemo } from 'react'
import { Platform, StyleSheet } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNativeTheme } from '@baishou/ui/native'
import { HapticTab } from '../../components/haptic-tab'
import { fadeTabAnimation } from '@/src/navigation/fadeStackAnimation'

/** 图标 + 文字内容区高度（不含底部安全区） */
const TAB_BAR_CONTENT_HEIGHT = 56

export default function TabLayout() {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const insets = useSafeAreaInsets()

  const tabBarBottomInset = Platform.OS === 'android' ? Math.max(insets.bottom, 8) : insets.bottom

  const sharedTabBarStyle = useMemo(
    () =>
      ({
        backgroundColor: colors.bgSurface,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.borderMuted,
        elevation: 0,
        shadowOpacity: 0,
        // 总高度 = 内容区 + 底部安全区；paddingBottom 由 React Navigation 默认注入，此处只覆盖 Android 最小底边距
        height: TAB_BAR_CONTENT_HEIGHT + tabBarBottomInset,
        paddingBottom: tabBarBottomInset
      }) as const,
    [colors.bgSurface, colors.borderMuted, tabBarBottomInset]
  )

  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        ...fadeTabAnimation,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: sharedTabBarStyle,
        tabBarButton: (props) => <HapticTab {...props} />,
        tabBarHideOnKeyboard: false,
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bgApp }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.diary'),
          tabBarStyle: {
            ...sharedTabBarStyle,
            backgroundColor: colors.bgSurface
          },
          tabBarIcon: ({ color }) => <MaterialIcons name="timeline" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="agent"
        options={{
          title: t('nav.agent'),
          tabBarHideOnKeyboard: false,
          tabBarIcon: ({ color }) => <MaterialIcons name="auto-awesome" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: t('summary.dashboard_title'),
          tabBarIcon: ({ color }) => <MaterialIcons name="menu-book" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('nav.settings'),
          tabBarIcon: ({ color }) => <MaterialIcons name="settings" size={24} color={color} />
        }}
      />
    </Tabs>
  )
}
