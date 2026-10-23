import React from 'react'
import { View } from 'react-native'
import { SegmentedControl } from '../SegmentedControl'
import { sharedTokens } from '../../theme/tokens'
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
  if (tabs.length <= 1) return null

  return (
    <View style={{ marginBottom: sharedTokens.spacing.mdTight }}>
      <SegmentedControl
        value={activeTab}
        options={tabs.map((tab) => ({ value: tab.key, label: tab.label }))}
        onChange={onTabChange}
      />
    </View>
  )
}
