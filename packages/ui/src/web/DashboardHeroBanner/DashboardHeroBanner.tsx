import { useTranslation } from 'react-i18next';
import React from 'react';

// TODO: [Agent1-Dependency] 替换


export const DashboardHeroBanner: React.FC = () => {
  const { t } = useTranslation();

  
  // mock random greeting
  const greeting = t('dashboard.greeting', '又见面了，今天过得怎样？');

  return (
    <div style={{
      width: '100%',
      height: 140,
      backgroundColor: 'var(--color-primary, #5BA8F5)',
      borderRadius: 20,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '0 28px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 8px 20px rgba(91, 168, 245, 0.25)'
    }}>
      <div style={{ fontSize: 22, fontWeight: 'bold', color: '#ffffff', zIndex: 1, letterSpacing: '-0.5px' }}>
        {t('common.app_title', '白守')} · {t('summary.collective_memories_title', '回忆')}
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.8)', marginTop: 8, zIndex: 1 }}>
        {t('summary.algorithm_desc', '基于白守级联折叠算法，自动过滤冗余数据，构建我们共同的记忆脉络。')}
      </div>
      
      {/* 装饰性背景球 */}
      <div style={{
        position: 'absolute', right: -20, top: -40, width: 140, height: 140, 
        borderRadius: '50%', background: 'linear-gradient(135deg, rgba(255,154,158,0.2) 0%, rgba(254,207,239,0.2) 100%)'
      }} />
      <div style={{
        position: 'absolute', right: 80, bottom: -30, width: 80, height: 80, 
        borderRadius: '50%', background: 'linear-gradient(135deg, rgba(161,196,253,0.3) 0%, rgba(194,233,251,0.3) 100%)'
      }} />
    </div>
  );
};
