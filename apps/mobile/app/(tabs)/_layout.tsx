import { Tabs } from 'expo-router';
import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '@baishou/ui/src/native/theme';

export default function TabLayout() {
  const { t } = useTranslation();
  const { colors, isDark } = useNativeTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.bgSurface,
          borderTopWidth: 0,
          elevation: 0,
        },
        headerStyle: {
          backgroundColor: colors.bgSurface,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: colors.textPrimary,
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.diary', '日记'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="timeline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="agent"
        options={{
          title: t('tabs.agent', '伙伴'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="auto-awesome" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: t('tabs.summary', '归档'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="menu-book" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings', '设置'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="settings" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
