import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { MdTimeline, MdAutoStories, MdSync, MdSettings, MdDragIndicator, MdWifiFind } from 'react-icons/md';
import styles from './Sidebar.module.css';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useUserProfileStore } from '@baishou/store';




export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const { profile, loadProfile } = useUserProfileStore();

  // Default nav items
  const navigate = useNavigate();
  const location = useLocation();
  
  const [navOrder, setNavOrder] = useState(() => {
  const saved = localStorage.getItem('desktop_sidebar_nav_order');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return ['diary', 'summary', 'lan', 'sync'];
  });

  const allItems = {
     'diary': { icon: <MdTimeline />, label: t('diary.title', '日记'), path: '/diary' },
     'summary': { icon: <MdAutoStories />, label: t('summary.dashboard_title', '全域仪表盘'), path: '/summary' },
     'lan': { icon: <MdWifiFind />, label: t('settings.lan_transfer', '局域网快传'), path: '/lan-transfer' },
     'sync': { icon: <MdSync />, label: t('common.data_sync', '数据同步'), path: '/data-sync' }
  };

  useEffect(() => {
    localStorage.setItem('desktop_sidebar_nav_order', JSON.stringify(navOrder));
  }, [navOrder]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onDragEnd = (result: DropResult) => {
  if (!result.destination) return;
    const newOrder = Array.from(navOrder);
    const [reorderedItem] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, reorderedItem as string);
    setNavOrder(newOrder);
  };

  const isAgentMode = location.pathname.startsWith('/c/') || location.pathname.startsWith('/agent');

  if (isAgentMode) return null;

  return (
    <motion.div 
      className={styles.sidebar}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className={styles.brandRow}>
         <div className={styles.logoBox}>
           <img src="assets/icon/icon.png" alt="Logo" className={styles.brandLogo} onError={(e) => {
  (e.target as HTMLImageElement).style.display = 'none';
               (e.target as HTMLImageElement).nextElementSibling!.classList.remove(styles.hidden);
           }}/>
           <div className={`${styles.logoFallback} styles.hidden`}>✨</div>
         </div>
         <div className={styles.brandText}>
            <div className={styles.brandName}>{t('common.app_title', 'BaiShou AI')}</div>
            <div className={styles.brandSlogan}>{t('settings.tagline_short', '下一代本地优先 AI 记忆终端')}</div>
         </div>
      </div>

      <div className={styles.menuContainer}>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="main-nav">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className={styles.navList}>
                {navOrder.map((id, index) => {


                  const item = allItems[id as keyof typeof allItems];
                  if (!item) return null;
                  const isSelected = location.pathname.startsWith(item.path);

                  return (
                    <Draggable key={id} draggableId={id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`${styles.navItemWrapper} ${snapshot.isDragging ? styles.dragging : ''}`}
                        >
                          <div
                            className={`${styles.navItem} ${isSelected ? styles.selected : ''}`}
                            onClick={() => navigate(item.path)}
                          >
                            <div {...provided.dragHandleProps} className={styles.dragHandle}>
                              <MdDragIndicator />
                            </div>
                            <span className={styles.navIcon}>{item.icon}</span>
                            <span className={styles.navLabel}>{item.label}</span>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <div className={styles.dividerWrapper}>
          <div className={styles.divider}></div>
        </div>

        <div className={styles.fixedNav}>
          <div 
             className={`${styles.navItem} ${location.pathname.startsWith('/settings') ? styles.selected : ''}`}
             onClick={() => navigate('/settings')}
          >
             <span className={styles.navIcon}><MdSettings /></span>
             <span className={styles.navLabel}>{t('settings.title', '设置')}</span>
          </div>
        </div>
      </div>

      <div className={styles.userCard}>
         <div className={styles.avatar}>
           {profile?.avatarPath && profile.avatarPath !== 'default' ? (
             <img 
               src={profile.avatarPath.startsWith('http') || profile.avatarPath.startsWith('data:') ? profile.avatarPath : `file://${profile.avatarPath}`} 
               alt="avatar" 
               style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}} 
             />
           ) : (
             (profile?.nickname || 'U').charAt(0).toUpperCase()
           )}
         </div>
         <div className={styles.userInfo}>
            <div className={styles.userName}>{profile?.nickname || t('settings.no_nickname', '默认用户')}</div>
         </div>
      </div>
    </motion.div>
  );
};
