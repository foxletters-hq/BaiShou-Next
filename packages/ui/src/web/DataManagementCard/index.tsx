import React, { useState } from 'react';
import styles from './DataManagementCard.module.css';

export interface SnapshotInfo {
  filename: string;
  sizeMB: string;
  fullPath: string;
  timeLabel: string;
}

export interface DataManagementCardProps {
  onExportZip: () => Promise<void>;
  onImportZip: (filePath: string) => Promise<void>;
  onPickFile?: () => Promise<string | null>;
  snapshots?: SnapshotInfo[];
}

export const DataManagementCard: React.FC<DataManagementCardProps> = ({
  onExportZip,
  onImportZip,
  onPickFile,
  snapshots = []
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExportZip();
    } finally {
      setIsExporting(false);
    }
  };

  const executeImport = async (filePath: string) => {
    const confirmText = window.prompt(
      '【高危操作警告】\n导入全量存档将直接销毁当前系统内的所有工作区与知识数据库设定，且不可逆转！\n\n请在下方输入 "CONFIRM" 以二次确认您知道自己在做什么：'
    );
    if (confirmText !== 'CONFIRM') {
      alert('已取消导入热重启');
      return;
    }

    setIsImporting(true);
    try {
      await onImportZip(filePath);
      alert('🎉 导入成功！白守即将挂载最新数据引擎...');
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      alert(`导入彻底失败，请检查文件权限或格式: ${e.message || '未知错误'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleImport = async () => {
    if (!onPickFile) return;
    const filePath = await onPickFile();
    if (!filePath) return;
    await executeImport(filePath);
  };

  const handleRestoreSnapshot = async (snapshot: SnapshotInfo) => {
    const flag = window.confirm(`您将使用 ${snapshot.timeLabel} (${snapshot.sizeMB} MB) 的快照覆盖现在的全部记录。\n覆盖后现在的修改统统消失，继续吗？`);
    if (!flag) return;
    await executeImport(snapshot.fullPath);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleInfo}>
           <h3 className={styles.title}>数据全量备份与容灾 (Data Vault)</h3>
           <p className={styles.subtitle}>
             白守数据由零构建、不受云端绑架。你可以随时将整个库无损封存为 ZIP 文件（跳过缓存），或将备份文件强制热加载回系统。
           </p>
        </div>
      </div>

      <div className={styles.actionsBox}>
        <div className={styles.cardSection}>
          <div className={styles.sectionHeader}>
            <h4>📦 铸造数据母体归档</h4>
            <p className={styles.sectionDesc}>导出所有工作区 (Vaults) 、日记片段、模型预设与超参设定。</p>
          </div>
          <button 
            className={styles.exportBtn} 
            onClick={handleExport}
            disabled={isExporting || isImporting}
          >
            {isExporting ? '⏳ 打包压制中...' : '生成完整 ZIP 母体备份'}
          </button>
        </div>

        <div className={styles.divider} />

        <div className={styles.cardSection}>
          <div className={styles.sectionHeader}>
            <h4 className={styles.dangerText}>☢️ 高危异体数据注入</h4>
            <p className={styles.sectionDesc}>警告：导入外部 ZIP 备份将强行切断当前所有数据库连接，并彻底覆写本地数据卷。</p>
          </div>
          <button 
            className={styles.importBtn} 
            onClick={handleImport}
            disabled={isExporting || isImporting || !onPickFile}
          >
            {isImporting ? '☢️ 数据灌入中...' : '选择 ZIP 强行覆盖合并'}
          </button>
        </div>

        <div className={styles.divider} />

        <div className={styles.cardSection}>
           <div className={styles.sectionHeaderHistory} onClick={() => setShowSnapshots(!showSnapshots)}>
             <div className={styles.historyTitleRow}>
                <h4>⏱️ 时序快照自动找回 (Auto Snapshots)</h4>
                <p className={styles.sectionDesc}>白守在重要节点会自动留下最多 10 份短期数据快照，以便您在崩溃或手误后吃后悔药。</p>
             </div>
             <div className={styles.collapseIndicator}>{showSnapshots ? '▲' : '▼'}</div>
           </div>
           
           {showSnapshots && (
              <div className={styles.snapshotList}>
                {snapshots.length === 0 ? (
                   <div className={styles.noSnapshots}>当前宿主机未保留任何近期时序快照。</div>
                ) : (
                   snapshots.map(sn => (
                     <div key={sn.filename} className={styles.snapshotItem}>
                        <div className={styles.snapInfo}>
                           <span className={styles.snapTime}>{sn.timeLabel}</span>
                           <span className={styles.snapSize}>{sn.sizeMB} MB</span>
                        </div>
                        <button 
                           className={styles.snapRestoreBtn} 
                           onClick={() => handleRestoreSnapshot(sn)}
                           disabled={isExporting || isImporting}
                        >
                           从该断点复活
                        </button>
                     </div>
                   ))
                )}
              </div>
           )}
        </div>

      </div>
    </div>
  );
};
