import React from 'react';
import styles from './StorageSettingsCard.module.css';

export interface StorageSettingsCardProps {
  sqliteSizeStats: string;
  vectorDbStats: string;
  mediaCacheStats: string;
  totalLimit?: string;
  onClearCache?: () => void;
  onVacuumDb?: () => void;
}

export const StorageSettingsCard: React.FC<StorageSettingsCardProps> = ({
  sqliteSizeStats,
  vectorDbStats,
  mediaCacheStats,
  totalLimit = '10GB',
  onClearCache,
  onVacuumDb
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleInfo}>
          <h3 className={styles.title}>物理存储空间大盘 (Storage Usage)</h3>
          <p className={styles.subtitle}>当前工作区在设备上所占据的实体空间概览。</p>
        </div>
      </div>

      <div className={styles.visualBar}>
         {/* 假定占比 */}
         <div className={styles.chunkSqlite} style={{ width: '40%' }} title={`主核数据: ${sqliteSizeStats}`} />
         <div className={styles.chunkVector} style={{ width: '25%' }} title={`向量智库: ${vectorDbStats}`} />
         <div className={styles.chunkMedia} style={{ width: '15%' }} title={`多媒体缓存: ${mediaCacheStats}`} />
         <div className={styles.chunkEmpty} style={{ width: '20%' }} />
      </div>
      
      <div className={styles.legend}>
         <div className={styles.legendItem}>
            <span className={styles.dot} style={{ background: '#4ade80' }}/>
            <div className={styles.legendText}>
               <span className={styles.legendTitle}>基础结构快照</span>
               <span className={styles.legendSize}>{sqliteSizeStats}</span>
            </div>
         </div>
         <div className={styles.legendItem}>
            <span className={styles.dot} style={{ background: '#c084fc' }}/>
            <div className={styles.legendText}>
               <span className={styles.legendTitle}>私知向量切片</span>
               <span className={styles.legendSize}>{vectorDbStats}</span>
            </div>
         </div>
         <div className={styles.legendItem}>
            <span className={styles.dot} style={{ background: '#60a5fa' }}/>
            <div className={styles.legendText}>
               <span className={styles.legendTitle}>文件及媒体热表</span>
               <span className={styles.legendSize}>{mediaCacheStats}</span>
            </div>
         </div>
      </div>

      <div className={styles.actions}>
         <button className={styles.vacuumBtn} onClick={onVacuumDb}>
            🧲 整理碎片化体积
         </button>
         <button className={styles.clearBtn} onClick={onClearCache}>
            🧹 扫除废弃冗余数据
         </button>
      </div>
    </div>
  );
};
