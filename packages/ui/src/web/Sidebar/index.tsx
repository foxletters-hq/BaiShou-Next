import React, { useState } from 'react';
import styles from './Sidebar.module.css';
import { useTranslation } from 'react-i18next';


export interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
}

interface SidebarProps {
  items: NavItem[];
  activeId: string;
  onItemClick: (id: string) => void;
  onOrderChange?: (newOrder: string[]) => void;
  user?: {
    nickname: string;
    avatarUrl?: string;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  activeId,
  onItemClick,
  onOrderChange,
  user
}) => {
  const { t } = useTranslation();
  const [orderedItems, setOrderedItems] = useState(items);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
  setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent drag image
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
  e.preventDefault();
    if (!draggedId || draggedId === id) return;
    
    setOrderedItems((prev) => {
  const oldIndex = prev.findIndex((i) => i.id === draggedId);
      const newIndex = prev.findIndex((i) => i.id === id);
      const newArray = [...prev];
      const [movedItem] = newArray.splice(oldIndex, 1);
      newArray.splice(newIndex, 0, movedItem);
      return newArray;
    });
  };

  const handleDragEnd = () => {
  setDraggedId(null);
    if (onOrderChange) {


      onOrderChange(orderedItems.map(i => i.id));
    }
  };

  return (
    <div className={styles.sidebar}>
      {/* Header / Logo */}
      <div className={styles.header}>
        <div className={styles.logoBox}>
          <img src="/assets/icon/icon.png" alt="Logo" className={styles.logoImg} />
        </div>
        <div className={styles.headerText}>
          <h2 className={styles.appName}>BaiShou Next</h2>
          <span className={styles.tagline}>{t('sidebar.tagline', 'AI 终端伴侣')}</span>
        </div>
      </div>

      {/* Nav List with simple DnD */}
      <div className={styles.navList}>
        {orderedItems.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, item.id)}
            onDragOver={(e) => handleDragOver(e, item.id)}
            onDragEnd={handleDragEnd}
            onClick={() => onItemClick(item.id)}
            className={`${styles.navItem} ${activeId === item.id ? styles.active : ''} ${draggedId === item.id ? styles.dragging : ''}`}
          >
            <div className={styles.dragHandle}>
              <span className={styles.dragIndicator}>≡</span>
            </div>
            <div className={styles.itemIcon}>{item.icon}</div>
            <span className={styles.itemLabel}>{item.label}</span>
          </div>
        ))}

        <div className={styles.divider} />
        
        {/* Settings - Static */}
        <div
          className={`${styles.navItem} ${activeId === 'settings' ? styles.active : ''}`}
          onClick={() => onItemClick('settings')}
        >
          <div className={`${styles.itemIcon} ${styles.staticIcon}`}>⚙️</div>
          <span className={styles.itemLabel}>{t('common.settings', '设置')}</span>
        </div>
      </div>

      {/* Footer / User Profile */}
      <div className={styles.footer}>
        <div className={styles.avatar}>
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="Avatar" />
          ) : (
            <span>{user?.nickname ? user.nickname[0].toUpperCase() : 'U'}</span>
          )}
        </div>
        <div className={styles.userInfo}>
          <span className={styles.nickname}>{user?.nickname || t('profile.no_nickname', '未设置昵称')}</span>
        </div>
      </div>
    </div>
  );
};
