import React from 'react'
import { View, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { SegmentedControl, useNativeTheme } from '@baishou/ui/native'
import { sharedTokens } from '@baishou/ui/theme/tokens'

interface SummaryTabBarProps {
  activeTab: 'panel' | 'gallery'
  onTabChange: (tab: 'panel' | 'gallery') => void
}

/** 回忆页顶部标签 — 与桌面分段滑块同款：描边轨道 + 表面选中块 */
export const SummaryTabBar: React.FC<SummaryTabBarProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.bgSurface,
          borderBottomColor: colors.borderMuted
        }
      ]}
    >
      <View style={styles.tabs}>
        <SegmentedControl
          value={activeTab}
          onChange={onTabChange}
          accessibilityLabel={t('summary.dashboard_title', '回忆')}
          options={[
            { value: 'panel', label: t('summary.panel_tab', '面板') },
            { value: 'gallery', label: t('summary.memory_gallery', '记忆画廊') }
          ]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  tabs: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center'
  }
})
