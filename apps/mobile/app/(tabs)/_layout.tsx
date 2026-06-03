import { Tabs } from 'expo-router'
import React from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'

export default function TabLayout() {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const sharedTabBarStyle = {
    backgroundColor: colors.bgSurface,
    borderTopWidth: 0,
    elevation: 0
  } as const

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: sharedTabBarStyle,
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
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="auto-awesome" size={24} color={color} />
          )
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
