import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { useNativeTheme } from '../theme'
import type { ContextChainTab, ContextChainTabItem } from './context-chain-dialog.types'

interface ContextChainTabBarProps {
  tabs: ContextChainTabItem[]
  activeTab: ContextChainTab
  onTabChange: (tab: ContextChainTab) => void
}

export const ContextChainTabBar: React.FC<ContextChainTabBarProps> = ({
  tabs,
  activeTab,
  onTabChange
}) => {
  const { colors, tokens } = useNativeTheme()

  if (tabs.length <= 1) return null

  return (
    <View
      style={{
        flexDirection: 'row',
        marginBottom: tokens.spacing.sm,
        backgroundColor: colors.bgSurfaceNormal,
        borderRadius: tokens.radius.full,
        padding: 4
      }}
    >
      {tabs.map((tab) => (
        <Pressable
          key={tab.key}
          onPress={() => onTabChange(tab.key)}
          style={{
            flex: 1,
            paddingVertical: tokens.spacing.xs,
            borderRadius: tokens.radius.full,
            backgroundColor: activeTab === tab.key ? colors.primary : 'transparent',
            alignItems: 'center'
          }}
        >
          <Text
            style={{
              fontSize: 14,
              color: activeTab === tab.key ? colors.onPrimary : colors.textSecondary,
              fontWeight: activeTab === tab.key ? '600' : '400'
            }}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}
