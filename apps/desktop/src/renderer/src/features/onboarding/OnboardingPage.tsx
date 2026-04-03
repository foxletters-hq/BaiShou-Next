import React from 'react'
import { useTranslation } from 'react-i18next';


export const OnboardingPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="glass-panel" style={{ margin: '2rem', textAlign: 'center' }}>
      <h1>{t('onboarding.welcome', '欢迎来到 BaiShou Next')}</h1>
      <p>{t('onboarding.welcome_sub', '正在为您分配个人工作区及初始化索引配置。')}</p>
      <button style={{ padding: '0.5rem 1rem', marginTop: '1rem', cursor: 'pointer' }}>
        {t('onboarding.start', '开始旅程')}
      </button>
    </div>
  )
}
