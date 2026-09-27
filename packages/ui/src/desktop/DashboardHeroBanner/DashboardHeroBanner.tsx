import { useTranslation } from 'react-i18next'
import React from 'react'
import { Sparkles } from 'lucide-react'
import './DashboardHeroBanner.css'

export const DashboardHeroBanner: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className="dashboard-hero-banner">
      <div className="dashboard-hero-header">
        <h2 className="dashboard-hero-title">
          {t('common.app_title', '白守')} · {t('summary.collective_memories_title', '回忆')}
        </h2>
        <span className="dashboard-hero-tag">
          <Sparkles size={11} style={{ marginRight: 4 }} />
          {t('summary.shared_memory', '共同回忆')}
        </span>
      </div>

      <p className="dashboard-hero-desc">
        {t(
          'summary.algorithm_desc',
          '基于白守级联折叠算法，自动过滤冗余数据，构建我们共同的记忆脉络。'
        )}
      </p>

      {/* 装饰性背景氛围光 */}
      <div className="dashboard-hero-orb-1" aria-hidden />
      <div className="dashboard-hero-orb-2" aria-hidden />
    </div>
  )
}
