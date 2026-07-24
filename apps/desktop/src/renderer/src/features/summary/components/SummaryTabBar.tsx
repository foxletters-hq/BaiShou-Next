import React from 'react'
import { useTranslation } from 'react-i18next'
import seg from '@baishou/ui/desktop/shared/SegmentedControl.module.css'

interface SummaryTabBarProps {
  activeTab: 'panel' | 'gallery'
  onTabChange: (tab: 'panel' | 'gallery') => void
}

/** 回忆页顶部标签 — 与「生成模式」分段滑块同款 */
export const SummaryTabBar: React.FC<SummaryTabBarProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation()

  return (
    <div className="sp-header">
      <div className={seg.group}>
        <button
          type="button"
          className={`${seg.btn} ${activeTab === 'panel' ? seg.btnActive : ''}`}
          onClick={() => onTabChange('panel')}
        >
          {t('summary.panel_tab', '大盘概况')}
        </button>
        <button
          type="button"
          className={`${seg.btn} ${activeTab === 'gallery' ? seg.btnActive : ''}`}
          onClick={() => onTabChange('gallery')}
        >
          {t('summary.memory_gallery', '归档画廊')}
        </button>
      </div>
    </div>
  )
}
