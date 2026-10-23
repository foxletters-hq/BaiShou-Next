import React from 'react'
import { useTranslation } from 'react-i18next'
import { SegmentedControl } from '@baishou/ui'

interface SummaryTabBarProps {
  activeTab: 'panel' | 'gallery'
  onTabChange: (tab: 'panel' | 'gallery') => void
}

/** 回忆页顶部标签 — 与「生成模式」分段滑块同款 */
export const SummaryTabBar: React.FC<SummaryTabBarProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation()

  return (
    <div className="sp-header">
      <SegmentedControl
        value={activeTab}
        options={[
          { value: 'panel', label: t('summary.panel_tab', '大盘概况') },
          { value: 'gallery', label: t('summary.memory_gallery', '归档画廊') }
        ]}
        onChange={onTabChange}
      />
    </div>
  )
}
