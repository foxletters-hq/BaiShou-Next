import { Tabs } from 'expo-router'
import React from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'

export default function TabLayout() {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.bgSurface,
          borderTopWidth: 0,
          elevation: 0
        },
        headerStyle: {
          backgroundColor: colors.bgSurface,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0
        },
        headerTintColor: colors.textPrimary,
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.diary'),
          headerShown: false,
          tabBarIcon: ({ color }) => <MaterialIcons name="timeline" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="agent"
        options={{
          title: t('nav.agent'),
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="auto-awesome" size={24} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: t('nav.summary'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="menu-book" size={24} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('nav.settings'),
          headerTitle: t('settings.title'),
          tabBarIcon: ({ color }) => <MaterialIcons name="settings" size={24} color={color} />
        }}
      />
    </Tabs>
  )
}
