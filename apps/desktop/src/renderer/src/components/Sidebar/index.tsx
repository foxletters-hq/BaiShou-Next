import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SessionListItem, SessionData } from '@baishou/ui';
import styles from './Sidebar.module.css';

const MOCK_SESSIONS: SessionData[] = [
  { id: '1', title: '探讨一下量子力学', isPinned: true },
  { id: '2', title: '翻译一段 Flutter 代码', isPinned: true },
  { id: '3', title: 'React Hooks 原理分析', isPinned: false },
  { id: '4', title: '新对话', isPinned: false },
];

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSessionId, setActiveSessionId] = useState<string>('1');
  
  return (
    <div className={styles.sidebar}>
      <div className={styles.brandRow}>
         <div className={styles.logoBox}>
            {/* Auto Awesome Icon placeholder */}
            ✨
         </div>
         <span className={styles.brandName}>BaiShou AI</span>
      </div>

      <div className={styles.newChatBox}>
        <button 
          className={styles.newChatBtn}
          onClick={() => {
            setActiveSessionId('');
            navigate('/');
          }}
        >
          <span className={styles.addIcon}>+</span>
          新对话
        </button>
      </div>

      <div className={styles.menuBox}>
         <div 
           className={`${styles.menuItem} ${location.pathname === '/settings' ? styles.menuItemSelected : ''}`}
           onClick={() => navigate('/settings')}
         >
            <span className={styles.menuItemIcon}>⚙️</span>
            <span>设置</span>
         </div>
      </div>

      <div className={styles.recentSection}>
         <div className={styles.recentHeader}>
            <span>最近对话</span>
         </div>

         <div className={styles.searchBox}>
            <span className={styles.searchIcon}>🔍</span>
            <input 
              type="text" 
              placeholder="搜索会话..."
              className={styles.searchInput}
            />
         </div>

         <div className={styles.sessionList}>
           {MOCK_SESSIONS.map(s => (
             <SessionListItem 
               key={s.id}
               session={s}
               isSelected={activeSessionId === s.id}
               onTap={() => {
                 setActiveSessionId(s.id);
                 navigate(`/c/${s.id}`);
               }}
             />
           ))}
         </div>
      </div>

      <div className={styles.userCard}>
         <div className={styles.avatar}>U</div>
         <span className={styles.userName}>Anson</span>
      </div>
    </div>
  );
};
