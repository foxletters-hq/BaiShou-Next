import React, { useMemo } from 'react';
import styles from './ActivityHeatmap.module.css';

import { generateHeatmapMatrix, ActivityData } from '../../utils/heatmap-matrix';
import { useTranslation } from 'react-i18next';


interface ActivityHeatmapProps {
  data: ActivityData[];
  year: number;
}



export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ data, year }) => {
  const { t } = useTranslation();
  const MONTHS = [t('common.jan', '一月'), t('common.feb', '二月'), t('common.mar', '三月'), t('common.apr', '四月'), t('common.may', '五月'), t('common.jun', '六月'), t('common.jul', '七月'), t('common.aug', '八月'), t('common.sep', '九月'), t('common.oct', '十月'), t('common.nov', '十一月'), t('common.dec', '十二月')];
const DAYS = [t('common.sun', '日'), t('common.mon', '一'), t('common.tue', '二'), t('common.wed', '三'), t('common.thu', '四'), t('common.fri', '五'), t('common.sat', '六')];
  const gridMatrix = useMemo(() => generateHeatmapMatrix(data, year), [data, year]);

  const getColorLevel = (count: number) => {


    if (count === 0) return styles.level0;
    if (count < 3) return styles.level1;
    if (count < 6) return styles.level2;
    if (count < 10) return styles.level3;
    return styles.level4;
  };

  return (
    <div className={styles.container}>
       <div className={styles.header}>
          <h3>{year} {t('activity.yearly_records', '年度交互记录')}</h3>
          <span className={styles.totalBadge}>{data.reduce((a, b) => a + b.count, 0)} {t('activity.interactions', '次交互')}</span>
       </div>
       
       <div className={styles.heatmapWrapper}>
          {/* Y Axis - Days */}
          <div className={styles.yAxis}>
             {DAYS.map((day, i) => (
               <span key={day} className={styles.axisLabel} style={{ visibility: i % 2 === 0 ? 'visible' : 'hidden' }}>
                 {day}
               </span>
             ))}
          </div>

          <div className={styles.graph}>
             {/* X Axis - Months */}
             <div className={styles.xAxis}>
                {MONTHS.map(month => (
                  <span key={month} className={styles.axisLabel}>{month}</span>
                ))}
             </div>
             
             {/* Grid */}
             <div className={styles.cellsGrid}>
                {gridMatrix.map((row, rowIndex) => (
                   <div key={rowIndex} className={styles.gridRow}>
                      {row.map((cell, colIndex) => (
                         <div 
                           key={colIndex} 
                           className={`${styles.cell} ${getColorLevel(cell.count)}`}
                            title={`${cell.date.toISOString().split('T')[0]} : ${cell.count} ${t('activity.times', '次')}`}
                         />
                      ))}
                   </div>
                ))}
             </div>
          </div>
       </div>

       <div className={styles.legend}>
          <span className={styles.axisLabel}>{t('activity.idle', '空闲')}</span>
          <div className={`${styles.cell} ${styles.level0}`} />
          <div className={`${styles.cell} ${styles.level1}`} />
          <div className={`${styles.cell} ${styles.level2}`} />
          <div className={`${styles.cell} ${styles.level3}`} />
          <div className={`${styles.cell} ${styles.level4}`} />
          <span className={styles.axisLabel}>{t('activity.frequent', '高频')}</span>
       </div>
    </div>
  );
};
