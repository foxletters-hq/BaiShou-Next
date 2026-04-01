import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SessionListItem, SessionData } from '@baishou/ui';
import styles from './Sidebar.module.css';
import { useSessionStore } from '@baishou/store';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessions, fetchSessions, deleteSessions, pinSession } = useSessionStore();
  
  // 从 URL 中提取会话 ID 保持高亮
  const activeSessionId = location.pathname.startsWith('/chat/') 
    ? location.pathname.split('/ chat/')[1] || location.pathname.split('/chat/')[1]
    : '';

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);
  
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
             navigate('/chat/new'); // 跳转到新建会话页或代理主页
          }}
        >
          <span className={styles.addIcon}>+</span>
          新对话
        </button>
      </div>

      <div className={styles.menuBox}>
         {[
           { id: 'chat', icon: '💬', label: '会话舱', path: '/' },
           { id: 'assistants', icon: '🤖', label: '集管中心', path: '/assistants' },
           { id: 'diary', icon: '📓', label: '日记与流', path: '/diary' },
           { id: 'summary', icon: '📊', label: '引擎洞察', path: '/summary' },
           { id: 'storage', icon: '💾', label: '储存站', path: '/storage' },
           { id: 'settings', icon: '⚙️', label: '偏好设置', path: '/settings' },
         ].map(item => {
           // Simple path matching logic
           const isSelected = item.path === '/' 
             ? location.pathname === '/' || location.pathname.startsWith('/c/')
             : location.pathname.startsWith(item.path);

           return (
             <div 
               key={item.id}
               className={`${styles.menuItem} ${isSelected ? styles.menuItemSelected : ''}`}
               onClick={() => navigate(item.path)}
             >
                <span className={styles.menuItemIcon}>{item.icon}</span>
                <span>{item.label}</span>
             </div>
           );
         })}
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
           {sessions.map(s => (
             <SessionListItem 
               key={s.id}
               session={{ 
                 id: s.id,
                 title: s.title || '新对话', 
                 isPinned: s.isPinned,
                 updatedAt: s.updatedAt instanceof Date ? s.updatedAt.getTime() : s.updatedAt
               }}
               isSelected={activeSessionId === s.id}
               onTap={() => {
                 navigate(`/chat/${s.id}`);
               }}
               onDelete={() => {
                 deleteSessions([s.id]);
               }}
               onPin={() => {
                 pinSession(s.id, !s.isPinned);
               }}
             />
           ))}
         </div>
      </div>

      <div className={styles.userCard}>
         <div className={styles.avatar}>U</div>
         <span className={styles.userName}>Anson 空间站</span>
      </div>
    </div>
  );
};
