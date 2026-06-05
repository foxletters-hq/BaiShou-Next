import { Tabs } from 'expo-router'
import React, { useMemo } from 'react'
import { StyleSheet } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'

export default function TabLayout() {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const sharedTabBarStyle = useMemo(
    () =>
      ({
        backgroundColor: colors.bgSurface,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.borderMuted,
        elevation: 0,
        shadowOpacity: 0
      }) as const,
    [colors.bgSurface, colors.borderMuted]
  )

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: sharedTabBarStyle,
        tabBarHideOnKeyboard: false,
        headerShown: false
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
