import React, { useState, useMemo } from 'react';
import styles from './AgentSessionList.module.css';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Ghost } from 'lucide-react';
import { SessionData, SessionListItem } from '../SessionListItem';

export interface AgentSessionListProps {
  sessions: SessionData[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  // Fallback handlers for item interactions
  onPinItem?: (id: string) => void;
  onRenameItem?: (id: string) => void;
  onDeleteItem?: (id: string) => void;
}

type GroupInfo = {
  titleKey: string;
  items: SessionData[];
};

export const AgentSessionList: React.FC<AgentSessionListProps> = ({
  sessions,
  selectedId,
  onSelect,
  onNewChat,
  onPinItem,
  onRenameItem,
  onDeleteItem
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  // Built-in intelligent list grouper
  const groupedSessions = useMemo(() => {
    let filtered = sessions;
    const query = searchQuery.trim().toLowerCase();
    
    if (query) {
      filtered = sessions.filter(
        s => s.title?.toLowerCase().includes(query) || s.snippet?.toLowerCase().includes(query)
      );
    }

    const pinned: SessionData[] = [];
    const today: SessionData[] = [];
    const yesterday: SessionData[] = [];
    const previous7: SessionData[] = [];
    const older: SessionData[] = [];

    const now = Date.now();
    const msInDay = 24 * 60 * 60 * 1000;

    for (const session of filtered) {
      if (session.isPinned) {
        pinned.push(session);
        continue;
      }

      if (!session.updatedAt) {
        older.push(session);
        continue;
      }

      const diff = now - session.updatedAt;
      if (diff < msInDay) {
        today.push(session);
      } else if (diff < msInDay * 2) {
        yesterday.push(session);
      } else if (diff < msInDay * 7) {
        previous7.push(session);
      } else {
        older.push(session);
      }
    }

    const groups: GroupInfo[] = [];
    if (pinned.length > 0) groups.push({ titleKey: t('agent.sessions.groupPinned', '已置顶'), items: pinned });
    if (today.length > 0) groups.push({ titleKey: t('agent.sessions.groupToday', '今天'), items: today });
    if (yesterday.length > 0) groups.push({ titleKey: t('agent.sessions.groupYesterday', '昨天'), items: yesterday });
    if (previous7.length > 0) groups.push({ titleKey: t('agent.sessions.groupWeek', '近 7 天'), items: previous7 });
    if (older.length > 0) groups.push({ titleKey: t('agent.sessions.groupOlder', '更早'), items: older });

    return groups;
  }, [sessions, searchQuery, t]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.newChatBtn} onClick={onNewChat} type="button">
           <Plus size={18} strokeWidth={2.5} />
           {t('agent.sessions.newChat', '发 起 超 链')}
        </button>

        <div className={styles.searchBox}>
          <span className={styles.searchIcon}><Search size={14} /></span>
          <input 
            type="text" 
            className={styles.searchInput}
            placeholder={t('common.search', '搜索历史记录 ...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.scrollArea}>
         {groupedSessions.length === 0 ? (
           <div className={styles.emptyState}>
             <Ghost size={32} opacity={0.3} />
             <span>{t('agent.sessions.noResults', '一片虚无...')}</span>
           </div>
         ) : (
           groupedSessions.map(group => (
             <div key={group.titleKey}>
               <div className={styles.groupHeader}>{group.titleKey}</div>
               {group.items.map(session => (
                 <SessionListItem 
                   key={session.id}
                   session={session}
                   isSelected={session.id === selectedId}
                   onTap={() => onSelect(session.id)}
                   onPin={onPinItem ? () => onPinItem(session.id) : undefined}
                   onRename={onRenameItem ? () => onRenameItem(session.id) : undefined}
                   onDelete={onDeleteItem ? () => onDeleteItem(session.id) : undefined}
                 />
               ))}
             </div>
           ))
         )}
      </div>
    </div>
  );
};
