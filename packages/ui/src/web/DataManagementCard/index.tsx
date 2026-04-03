import React, { useState } from 'react';
import styles from './DataManagementCard.module.css';
import { useTranslation } from 'react-i18next';


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
  const { t } = useTranslation();
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
      t('data.import_confirm_msg', '【替换警报】导入本地备份将抹平目前工作区拥有的全体聊天记录、属性集与上下文。
若要继续操作，请在弹窗验证行键入 "CONFIRM"：')
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
    const flag = window.confirm(t('data.snapshot_confirm', '即刻调用 {{timeLabel}} 版本 ({{sizeMB}} MB) 对现役存储域执行整体降级/回档。
此后，现今累积的所有状态更迭均将随之消尽。
确定降级？', { timeLabel: snapshot.timeLabel, sizeMB: snapshot.sizeMB }));
    if (!flag) return;
    await executeImport(snapshot.fullPath);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleInfo}>
           <h3 className={styles.title}>{t('data.title', '物理隔离层本地存档 (Data Vault)')}</h3>
           <p className={styles.subtitle}>
             {t('data.desc', '由于白守采取纯净的本地优先体系，在此您可以自由将全体库数据打入无损压缩的 ZIP 进行冷备份或多端移动流转。')}
           </p>
        </div>
      </div>

      <div className={styles.actionsBox}>
        <div className={styles.cardSection}>
          <div className={styles.sectionHeader}>
            <h4>📦 {t('data.export_title', '整体提纯导出快照模块')}</h4>
            <p className={styles.sectionDesc}>{t('data.export_desc', '将包含您现役的主工作层状态、助手属性面具及历史对话生成一个离线压缩体。')}</p>
          </div>
          <button 
            className={styles.exportBtn} 
            onClick={handleExport}
            disabled={isExporting || isImporting}
          >
            {isExporting ? t('data.exporting', '🧩 档案打包转储进度进行...') : t('data.export_btn', '压缩并产出完整单体包 (ZIP)')}
          </button>
        </div>

        <div className={styles.divider} />

        <div className={styles.cardSection}>
          <div className={styles.sectionHeader}>
            <h4 className={styles.dangerText}>☢️ {t('data.import_title', '强覆盖性异体录入模块')}</h4>
            <p className={styles.sectionDesc}>{t('data.import_desc', '引入已存在的 ZIP 快照来全局重置当前库资料。这一途径将引起灾难级的记录切断抹除，注意确认版本对应。')}</p>
          </div>
          <button 
            className={styles.importBtn} 
            onClick={handleImport}
            disabled={isExporting || isImporting || !onPickFile}
          >
            {isImporting ? t('data.importing', '⚠️ 置换核心层录入...') : t('data.import_btn', '提取外部包裹执行系统置换')}
          </button>
        </div>

        <div className={styles.divider} />

        <div className={styles.cardSection}>
           <div className={styles.sectionHeaderHistory} onClick={() => setShowSnapshots(!showSnapshots)}>
             <div className={styles.historyTitleRow}>
                <h4>⏱️ {t('data.auto_snapshot_title', '内建断层点无缝召回 (Snapshots)')}</h4>
                <p className={styles.sectionDesc}>{t('data.auto_snapshot_desc', '系统引擎会在重大变更执行前自持暂存不超过一定数量的副本帧，供遇灾或不可控操作后的“时光倒流”救援干预使用。')}</p>
             </div>
             <div className={styles.collapseIndicator}>{showSnapshots ? '▲' : '▼'}</div>
           </div>
           
           {showSnapshots && (
              <div className={styles.snapshotList}>
                {snapshots.length === 0 ? (
                   <div className={styles.noSnapshots}>{t('data.no_snapshots', '暂未能探知到任意短期驻留切片可供取用。')}</div>
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
                           {t('data.recover_btn', '复苏回滚指令下达')}
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
