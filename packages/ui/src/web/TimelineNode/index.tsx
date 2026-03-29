import React from 'react';
import styles from './TimelineNode.module.css';

interface TimelineNodeProps {
  date: string;
  time: string;
  isFirst?: boolean;
  isLast?: boolean;
  color?: string;
  children: React.ReactNode;
}

export const TimelineNode: React.FC<TimelineNodeProps> = ({
  date,
  time,
  isFirst = false,
  isLast = false,
  color = 'var(--color-primary)',
  children
}) => {
  return (
     <div className={styles.nodeContainer}>
        <div className={styles.timeAxis}>
           <div className={styles.timeText}>{time}</div>
           <div className={styles.dateText}>{date}</div>
        </div>

        <div className={styles.trackerAxis}>
           {/* Line Top */}
           {!isFirst && <div className={styles.lineTop} />}
           
           {/* Dot */}
           <div className={styles.dot} style={{ backgroundColor: color }}>
              <div className={styles.dotInner} />
           </div>

           {/* Line Bottom */}
           {!isLast && <div className={styles.lineBottom} />}
        </div>

        <div className={styles.contentAxis}>
           <div className={styles.cardBox}>
              {children}
           </div>
        </div>
     </div>
  );
};
