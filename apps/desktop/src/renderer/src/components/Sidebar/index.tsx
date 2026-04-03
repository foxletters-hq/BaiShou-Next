import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { MdTimeline, MdAutoStories, MkWifi, MdSync, MdSettings, MdDragIndicator } from 'react-icons/md';
import styles from './Sidebar.module.css';
import { useTranslation } from 'react-i18next';


// Default nav items
const defaultNavItems = [
  { id: 'diary', branchIndex: 0, icon: <MdTimeline />, label: t('nav.diary', '日记'), path: '/diary' },
  { id: 'summary', branchIndex: 2, icon: <MdAutoStories />, label: t('nav.summary', '概览面板'), path: '/summary' },
  // using some standard icons since MkWifi might not exist, but let's use MdSettings for now just to make sure
  // Wait, let's use standard icons
];

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isAgent = location.pathname.startsWith('/agent') || location.pathname.startsWith('/c/');
  
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
     'diary': { icon: <MdTimeline />, label: '日记', path: '/diary' },
     'summary': { icon: <MdAutoStories />, label: '全域仪表盘', path: '/summary' },
     'lan': { icon: <MdSettings />, label: t('nav.lan_transfer', '局域网快传'), path: '/settings/lan-transfer' }, // using Settings as fallback icon
     'sync': { icon: <MdSync />, label: t('nav.data_sync', '数据同步'), path: '/settings/data-sync' }
  };

  useEffect(() => {
    localStorage.setItem('desktop_sidebar_nav_order', JSON.stringify(navOrder));
  }, [navOrder]);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newOrder = Array.from(navOrder);
    const [reorderedItem] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, reorderedItem as string);
    setNavOrder(newOrder);
  };

  if (isAgent) return null; // Hide sidebar in Agent view

  return (
    <div className={styles.sidebar}>
      <div className={styles.brandRow}>
         <div className={styles.logoBox}>
           {/* Replace with actual image later, using U for now as per flutter avatar logic but this is Brand */}
           <img src="assets/icon/icon.png" alt="Logo" className={styles.brandLogo} onError={(e) => {
               (e.target as HTMLImageElement).style.display = 'none';
               (e.target as HTMLImageElement).nextElementSibling!.classList.remove(styles.hidden);
           }}/>
           <div className={`${styles.logoFallback} styles.hidden`}>✨</div>
         </div>
         <div className={styles.brandText}>
            <div className={styles.brandName}>BaiShou AI</div>
            <div className={styles.brandSlogan}>{t('sidebar.slogan', '下一代本地优先 AI 记忆终端')}</div>
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
             <span className={styles.navLabel}>{t('common.settings', '偏好设置')}</span>
          </div>
        </div>
      </div>

      <div className={styles.userCard}>
         <div className={styles.avatar}>A</div>
         <div className={styles.userInfo}>
            <div className={styles.userName}>{t('sidebar.default_vault', '默认工作站')}</div>
         </div>
      </div>
    </div>
  );
};
