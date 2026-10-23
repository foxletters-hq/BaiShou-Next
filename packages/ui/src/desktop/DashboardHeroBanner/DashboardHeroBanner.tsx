import { useTranslation } from 'react-i18next'
import React from 'react'
import { Sparkles } from 'lucide-react'
import './DashboardHeroBanner.css'
import { sharedTokens } from '../../theme/tokens'

/** 桌面端回忆页顶卡：实色表面 + 左侧主色条，对齐移动端极简设计 */
export const DashboardHeroBanner: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className="dashboard-hero-banner">
      <div className="dashboard-hero-accent" aria-hidden />
      <div className="dashboard-hero-copy">
        <div className="dashboard-hero-header">
          <h2 className="dashboard-hero-title">
            {t('common.app_title', '白守')} · {t('summary.collective_memories_title', '回忆')}
          </h2>
          <span className="dashboard-hero-tag">
            <Sparkles size={11} style={{ marginRight: sharedTokens.spacing.xs }} />
            {t('summary.shared_memory', '共同回忆')}
          </span>
        </div>

        <p className="dashboard-hero-desc">
          {t('summary.algorithm_desc', '层层沉淀时光印记，凝练日常细节，构建我们共同的记忆脉络。')}
        </p>
      </div>
    </div>
  )
}
