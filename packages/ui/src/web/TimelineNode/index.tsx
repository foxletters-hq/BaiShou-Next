import React from 'react';
import type { TimelineNode as TimelineNodeType } from '@baishou/shared';
// @ts-ignore
import styles from './TimelineNode.module.css';
import { DiaryMetaCard } from '../DiaryMetaCard';

interface TimelineNodeProps {
  node: TimelineNodeType;
  isFirst?: boolean;
  isLast?: boolean;
  onDiaryDelete?: (id: number) => void;
  onDiaryClick?: (id: number) => void;
}

export const TimelineNode: React.FC<TimelineNodeProps> = ({
  node,
  isFirst = false,
  isLast = false,
  onDiaryDelete,
  onDiaryClick
}) => {
  if (node.type === 'month_separator') {
    return (
      <div className={styles.monthSeparatorBlock}>
        <h2 className={styles.monthHeader}>
          {node.date.getFullYear()}/{node.date.getMonth() + 1}
        </h2>
      </div>
    );
  }

  // format time like "10:00"
  const hours = node.date.getHours().toString().padStart(2, '0');
  const minutes = node.date.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  return (
    <div className={styles.nodeContainer}>
      <div className={styles.timeAxis}>
        <div className={styles.timeText}>{timeStr}</div>
      </div>

      <div className={styles.trackerAxis}>
        {!isFirst && <div className={styles.lineTop} />}
        <div className={styles.dot}>
          <div className={styles.dotInner} />
        </div>
        {!isLast && <div className={styles.lineBottom} />}
      </div>

      <div className={styles.contentAxis}>
        {node.meta && (
          <DiaryMetaCard 
            meta={node.meta} 
            onDelete={onDiaryDelete ? () => onDiaryDelete(node.meta!.id) : undefined}
            onClick={onDiaryClick ? () => onDiaryClick(node.meta!.id) : undefined}
          />
        )}
      </div>
    </div>
  );
};
