import React from 'react';
import type { DiaryMeta } from '@baishou/shared';
// @ts-ignore
import styles from './DiaryMetaCard.module.css';

interface DiaryMetaCardProps {
  meta: DiaryMeta;
  onDelete?: () => void;
  onClick?: () => void;
}

export const DiaryMetaCard: React.FC<DiaryMetaCardProps> = ({ meta, onDelete, onClick }) => {
  const day = meta.date.getDate();
  const dayStr = day < 10 ? `0${day}` : `${day}`;
  
  return (
    <div className={styles.card} onClick={onClick} data-testid="diary-meta-card">
       <div className={styles.header}>
          <div className={styles.dateInfo}>
             <span className={styles.day}>{dayStr}</span>
          </div>
          {onDelete && (
             <button
               className={styles.deleteBtn}
               onClick={(e) => {
                 e.stopPropagation();
                 onDelete();
               }}
               aria-label="delete"
             >
               Delete
             </button>
          )}
       </div>
       <div className={styles.preview}>
          {meta.preview}
       </div>
       {meta.tags && meta.tags.length > 0 && (
          <div className={styles.tagsArea}>
             {meta.tags.map((t, idx) => (
                <span key={idx} className={styles.tag}>
                   #{t}
                </span>
             ))}
          </div>
       )}
    </div>
  );
};
