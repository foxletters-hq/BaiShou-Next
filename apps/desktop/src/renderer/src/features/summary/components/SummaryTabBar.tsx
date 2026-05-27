import React from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, Layers } from 'lucide-react'

interface SummaryTabBarProps {
  activeTab: 'panel' | 'gallery'
  onTabChange: (tab: 'panel' | 'gallery') => void
}

/** 摘要页面顶部 Chrome 风格 Tab 栏 */
export const SummaryTabBar: React.FC<SummaryTabBarProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation()

  return (
    <div className="sp-header">
      <div className="sp-tabs">
        <div
          className={`sp-tab ${activeTab === 'panel' ? 'active' : ''}`}
          onClick={() => onTabChange('panel')}
        >
          <LayoutDashboard size={18} /> {t('summary.panel_tab', '大盘概况')}
        </div>
        <div
          className={`sp-tab ${activeTab === 'gallery' ? 'active' : ''}`}
          onClick={() => onTabChange('gallery')}
        >
          <Layers size={18} /> {t('summary.memory_gallery', '归档画廊')}
        </div>
      </div>
    </div>
  )
}
