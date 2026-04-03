import React from 'react'
import { useTranslation } from 'react-i18next';


export const HomePage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="glass-panel" style={{ margin: '2rem' }}>
      <h1>{t('nav.summary', '概览面板')} (Home)</h1>
      <p>{t('home.desc', '仪表盘暂未施工完成，可切换前往日记页查看以往记录。')}</p>
    </div>
  )
}
