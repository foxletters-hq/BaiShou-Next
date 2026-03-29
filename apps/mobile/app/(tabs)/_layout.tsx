import { Tabs } from 'expo-router';
import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const tintColor = colorScheme === 'dark' ? '#5BA8F5' : '#1565C0';
  const inactiveColor = colorScheme === 'dark' ? '#94A3B8' : '#475569';
  const backgroundColor = colorScheme === 'dark' ? '#101922' : '#F6F7F8';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tintColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor,
          borderTopWidth: 0,
          elevation: 0,
        },
        headerStyle: {
          backgroundColor,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: colorScheme === 'dark' ? '#ffffff' : '#000000',
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '日记',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name={focused ? 'timeline' : 'timeline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="agent"
        options={{
          title: '伙伴',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name={focused ? 'auto-awesome' : 'auto-awesome'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: '归档',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name={focused ? 'menu-book' : 'menu-book'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name={focused ? 'settings' : 'settings'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
