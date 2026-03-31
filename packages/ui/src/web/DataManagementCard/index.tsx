import React, { useState } from 'react';
import styles from './DataManagementCard.module.css';

export interface DataManagementCardProps {
  onExportZip: () => Promise<void>;
  onImportZip: (filePath: string) => Promise<void>;
  onPickFile?: () => Promise<string | null>; // specific to electron/web environment
}

export const DataManagementCard: React.FC<DataManagementCardProps> = ({
  onExportZip,
  onImportZip,
  onPickFile
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExportZip();
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!onPickFile) return;

    // Warning confirmation before destructive import
    const confirmText = window.prompt(
      '【高危操作警告】\n导入全量存档将直接销毁当前系统内的所有 Workspace 数据（包括日志、智能体设定），且不可逆转！\n\n请在下方输入 "CONFIRM" 以二次确认：'
    );
    if (confirmText !== 'CONFIRM') {
      alert('已取消导入');
      return;
    }

    const filePath = await onPickFile();
    if (!filePath) return;

    setIsImporting(true);
    try {
      await onImportZip(filePath);
      alert('导入成功！白守即将挂载最新数据引擎...');
      // It's probably a good idea to reload the window to let the app fully refresh after DB reset
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      alert(`导入失败: ${e.message || '未知错误'}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>数据全量备份与容灾 (Data Archive)</h3>
        <p className={styles.subtitle}>
          白守数据完全属于你。你可以随时将整个库无损封存为 ZIP 文件（跳过缓存），或将备份文件强制热加载回系统。
        </p>
      </div>

      <div className={styles.actions}>
        <div className={styles.cardSection}>
          <div className={styles.sectionHeader}>
            <h4>生成归档备份</h4>
            <p className={styles.sectionDesc}>导出所有工作区 (Vaults) 、日记切片、智库向量与全局设定。</p>
          </div>
          <button 
            className={styles.exportBtn} 
            onClick={handleExport}
            disabled={isExporting || isImporting}
          >
            {isExporting ? '打包中...' : '生成完整 ZIP 备份'}
          </button>
        </div>

        <div className={styles.divider} />

        <div className={styles.cardSection}>
          <div className={styles.sectionHeader}>
            <h4 className={styles.dangerText}>从归档热恢复</h4>
            <p className={styles.sectionDesc}>警告：导入备份将强行切断当前所有数据库连接，并彻底覆写本地数据卷。</p>
          </div>
          <button 
            className={styles.importBtn} 
            onClick={handleImport}
            disabled={isExporting || isImporting || !onPickFile}
          >
            {isImporting ? '数据注入中...' : '选择 ZIP 强制合并注入'}
          </button>
        </div>
      </div>
    </div>
  );
};
