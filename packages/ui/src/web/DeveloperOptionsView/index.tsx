import React from 'react';
import { useTranslation } from 'react-i18next';


export const DeveloperOptionsView: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div style={{ 
      padding: '32px 24px', 
      borderRadius: 16, 
      background: 'rgba(255,255,255,0.02)', 
      border: '1px dashed rgba(255,255,255,0.1)' 
    }}>
      <h3 style={{ marginBottom: 12, fontSize: 18, fontWeight: 600 }}>{t('dev.title', '🛠 实验区特性干预与黑盒操纵')}</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
        {t('dev.desc', '这可能包含主 IPC 链探查、系统端口层截流甚至底层数据库压测。无专业背景请止步于此，不规范动作大概率可诱发终端崩溃。')}<br />
        <span style={{ color: '#4ade80' }}>{t('dev.coming_soon', '（待核心权限实验仓释放）')}</span>
      </p>
    </div>
  );
};
