import React, { useMemo } from 'react';
import styles from './ActivityHeatmap.module.css';

export interface ActivityData {
  date: string; // YYYY-MM-DD
  count: number;
}

interface ActivityHeatmapProps {
  data: ActivityData[];
  year: int;
}

const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const DAYS = ['日', '一', '二', '三', '四', '五', '六'];

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ data, year }) => {
  const datesMap = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(d => map.set(d.date, d.count));
    return map;
  }, [data]);

  const gridMatrix = useMemo(() => {
    const matrix: { date: Date; count: number }[][] = Array.from({ length: 7 }, () => []);
    
    // Simple mock logic for displaying 52 weeks of the year
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    
    let currentDate = new Date(startDate);
    // Rewind to Sunday
    currentDate.setDate(currentDate.getDate() - currentDate.getDay());
    
    while (currentDate <= endDate || currentDate.getDay() !== 0) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const count = datesMap.get(dateStr) || 0;
      matrix[currentDate.getDay()].push({
         date: new Date(currentDate),
         count
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return matrix;
  }, [datesMap, year]);

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
          <h3>{year} 年度数字印迹</h3>
          <span className={styles.totalBadge}>{data.reduce((a, b) => a + b.count, 0)} 次交互</span>
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
                           title={`${cell.date.toISOString().split('T')[0]} : ${cell.count} 次`}
                         />
                      ))}
                   </div>
                ))}
             </div>
          </div>
       </div>

       <div className={styles.legend}>
          <span className={styles.axisLabel}>空闲</span>
          <div className={`${styles.cell} ${styles.level0}`} />
          <div className={`${styles.cell} ${styles.level1}`} />
          <div className={`${styles.cell} ${styles.level2}`} />
          <div className={`${styles.cell} ${styles.level3}`} />
          <div className={`${styles.cell} ${styles.level4}`} />
          <span className={styles.axisLabel}>高频</span>
       </div>
    </div>
  );
};
