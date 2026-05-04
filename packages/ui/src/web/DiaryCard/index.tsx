import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './DiaryCard.module.css';
import { MarkdownRenderer } from '../MarkdownRenderer';

export interface Diary {
  id: string;
  date: Date;
  content: string;
  tags: string[];
}

interface DiaryCardProps {
  diary: Diary;
  onClick?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const DiaryCard: React.FC<DiaryCardProps> = ({ diary, onClick, onEdit, onDelete }) => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  const WEEKDAYS = [
    t('diary.weekday.sunday', '周日'),
    t('diary.weekday.monday', '周一'),
    t('diary.weekday.tuesday', '周二'),
    t('diary.weekday.wednesday', '周三'),
    t('diary.weekday.thursday', '周四'),
    t('diary.weekday.friday', '周五'),
    t('diary.weekday.saturday', '周六'),
  ];

  const day = diary.date.getDate().toString().padStart(2, '0');
  const weekday = WEEKDAYS[diary.date.getDay()];
  const yearMonth = `${diary.date.getFullYear()} · ${diary.date.getMonth() + 1}${t('diary.month_suffix', '月')}`;

  // Deterministic tag color generation based on string
  const getTagColorClass = (tag: string) => {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
        hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % 4;
    return styles[`tagColor${colorIndex}`];
  };

  return (
    <div 
      className={`${styles.card} ${isHovered ? styles.hovered : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick?.(diary.id)}
    >
       <div className={styles.header}>
         <div className={styles.dateBlock}>
            <span className={styles.day}>{day}</span>
            <div className={styles.metaCol}>
               <span className={styles.weekday}>{weekday}</span>
               <span className={styles.yearMonthBadge}>{yearMonth}</span>
            </div>
         </div>
       </div>

       <div className={styles.contentMask}>
          <div className={styles.contentInner}>
            {/* Limit markdown preview length */}
           <MarkdownRenderer content={diary.content.length > 500 ? diary.content.substring(0, 500) + '...' : diary.content} />
          </div>
       </div>

       {diary.tags && diary.tags.length > 0 && (
          <div className={styles.tagsArea}>
             {diary.tags.filter(t => t.trim()).map(tag => (
                <span key={tag} className={`${styles.tag} ${getTagColorClass(tag)}`}>
                   #{tag}
                </span>
             ))}
          </div>
       )}

       <div className={`${styles.actionBar} ${isHovered ? styles.actionVisible : ''}`}>
          <div className={styles.actionDivider} />
          <div className={styles.actionBtns}>
              <button 
                  className={styles.actionBtn} 
                  onClick={(e) => { e.stopPropagation(); onEdit?.(diary.id); }}
              >
                  ✏️ {t('diary.edit', '编辑')}
              </button>
              <button 
                  className={`${styles.actionBtn} ${styles.deleteBtn}`} 
                  onClick={(e) => { e.stopPropagation(); onDelete?.(diary.id); }}
              >
                  🗑️ {t('diary.delete', '删除')}
              </button>
          </div>
       </div>
    </div>
  );
};
