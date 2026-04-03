import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './StorageSettingsCard.module.css';

export interface StorageSettingsCardProps {
  storageRootPath?: string;
  sqliteSizeStats: string;
  vectorDbStats: string;
  mediaCacheStats: string;
  totalLimit?: string;
  onChangeRoot?: () => Promise<void>;
  onClearCache?: () => void;
  onVacuumDb?: () => void;
}

export const StorageSettingsCard: React.FC<StorageSettingsCardProps> = ({
  storageRootPath = 'C:\\Users\\Default\\BaishouStorage',
  sqliteSizeStats,
  vectorDbStats,
  mediaCacheStats,
  // totalLimit - 保留在 Props 接口中但当前界面未展示，不解构
  onChangeRoot,
  onClearCache,
  onVacuumDb
}) => {
  const { t } = useTranslation();
  const [isScanning, setIsScanning] = useState(false);

  const handleChangeRoot = async () => {
    if (!onChangeRoot) return;
    setIsScanning(true);
    try {
      await onChangeRoot();
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className={styles.container}>
      {isScanning && (
        <div className={styles.scanOverlay}>
          <div className={styles.scanSpinner} />
          <p>{t('settings.storage_scanning', '正在处理...')}</p>
        </div>
      )}

      <div className={styles.header}>
        <div className={styles.titleInfo}>
          <h3 className={styles.title}>{t('settings.storage_usage_title', '存储空间使用情况')}</h3>
          <p className={styles.subtitle}>{t('settings.storage_usage_desc', '当前工作区在设备上所占据的物理空间概览。')}</p>
        </div>
      </div>

      <div className={styles.rootPathGroup}>
         <div className={styles.pathLabel}>{t('settings.storage_root', '数据根目录')}</div>
         <div className={styles.pathDisplayBox}>
            <span className={styles.pathText}>{storageRootPath}</span>
            <button className={styles.changeRootBtn} onClick={handleChangeRoot}>
               {t('settings.change_storage_root', '更换根目录')}
            </button>
         </div>
      </div>

      <div className={styles.visualBar}>
         {/* 假定占比，在实际业务中建议传入 size 取百分比 */}
         <div className={styles.chunkSqlite} style={{ width: '40%' }} title={`${t('settings.storage_sqlite', '数据库')}: ${sqliteSizeStats}`} />
         <div className={styles.chunkVector} style={{ width: '25%' }} title={`${t('settings.storage_vector', '向量缓存')}: ${vectorDbStats}`} />
         <div className={styles.chunkMedia} style={{ width: '15%' }} title={`${t('settings.storage_media', '文件及媒体缓存')}: ${mediaCacheStats}`} />
         <div className={styles.chunkEmpty} style={{ width: '20%' }} />
      </div>
      
      <div className={styles.legend}>
         <div className={styles.legendItem}>
            <span className={styles.dot} style={{ background: '#4ade80' }}/>
            <div className={styles.legendText}>
               <span className={styles.legendTitle}>{t('settings.storage_sqlite', '数据库')}</span>
               <span className={styles.legendSize}>{sqliteSizeStats}</span>
            </div>
         </div>
         <div className={styles.legendItem}>
            <span className={styles.dot} style={{ background: '#c084fc' }}/>
            <div className={styles.legendText}>
               <span className={styles.legendTitle}>{t('settings.storage_vector', '向量缓存')}</span>
               <span className={styles.legendSize}>{vectorDbStats}</span>
            </div>
         </div>
         <div className={styles.legendItem}>
            <span className={styles.dot} style={{ background: '#60a5fa' }}/>
            <div className={styles.legendText}>
               <span className={styles.legendTitle}>{t('settings.storage_media', '文件及媒体缓存')}</span>
               <span className={styles.legendSize}>{mediaCacheStats}</span>
            </div>
         </div>
      </div>

      <div className={styles.actions}>
         <button className={styles.vacuumBtn} onClick={onVacuumDb}>
            🧲 {t('settings.storage_vacuum', '清理碎片')}
         </button>
         <button className={styles.clearBtn} onClick={onClearCache}>
            🧹 {t('settings.storage_clear_cache', '清理冗余数据')}
         </button>
      </div>
    </div>
  );
};
