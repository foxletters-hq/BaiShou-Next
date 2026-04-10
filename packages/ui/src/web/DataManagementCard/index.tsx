import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdOutlineStorage, MdOutlineDownload, MdOutlineUploadFile, MdHistory, MdChevronRight, MdOutlineArchive } from 'react-icons/md';
import { useDialog } from '../Dialog';
import { useToast } from '../Toast/useToast';
import '../shared/SettingsListTile.css';
import { SettingsExpansionTile } from '../shared/SettingsExpansionTile';

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
  const dialog = useDialog();
  const toast = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try { await onExportZip(); } finally { setIsExporting(false); }
  };

  const handleImport = async () => {
    if (!onPickFile) return;
    const filePath = await onPickFile();
    if (!filePath) return;

    const confirmed = await dialog.confirm(t('settings.confirm_restore_desc', '引入备份将覆盖当前所有数据，此操作不可恢复！确认继续？'));
    if (!confirmed) return;

    setIsImporting(true);
    try {
      await onImportZip(filePath);
      toast.showSuccess(t('settings.restore_success_simple', '恢复成功'));
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      toast.showError(t('settings.restore_failed', '恢复失败：') + e.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleRestoreSnapshot = async (snapshot: SnapshotInfo) => {
    const confirmed = await dialog.confirm(t('settings.confirm_restore', '确认从快照恢复？'));
    if (!confirmed) return;
    setIsImporting(true);
    try {
      await onImportZip(snapshot.fullPath);
      toast.showSuccess(t('settings.restore_success_simple', '恢复成功'));
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      toast.showError(t('settings.restore_failed', '恢复失败：') + e.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <SettingsExpansionTile
      icon={<MdOutlineStorage size={24} />}
      title={t('settings.data_management', '数据管理')}
      subtitle={t('settings.data_management_desc', '导出、导入和恢复数据')}
    >
        {/* 导出数据 */}
        <button className="settings-list-tile" onClick={handleExport} disabled={isExporting || isImporting}>
          <div className="settings-list-tile-leading">
            <MdOutlineDownload size={22} />
          </div>
          <div className="settings-list-tile-content">
            <span className="settings-list-tile-title">{t('settings.export_data', '导出数据')}</span>
            <span className="settings-list-tile-subtitle">{t('settings.export_desc', '将所有数据导出为 ZIP 压缩包')}</span>
          </div>
          <MdChevronRight size={22} className="settings-list-tile-trailing" />
        </button>

        <div className="settings-list-divider" />

        {/* 导入数据 */}
        <button className="settings-list-tile" onClick={handleImport} disabled={isExporting || isImporting || !onPickFile}>
          <div className="settings-list-tile-leading">
            <MdOutlineUploadFile size={22} />
          </div>
          <div className="settings-list-tile-content">
            <span className="settings-list-tile-title">{t('settings.import_data', '导入数据')}</span>
            <span className="settings-list-tile-subtitle">{t('settings.import_desc', '从 ZIP 备份文件恢复数据（将覆盖当前数据）')}</span>
          </div>
          <MdChevronRight size={22} className="settings-list-tile-trailing" />
        </button>

        <div className="settings-list-divider" />

        {/* 恢复快照 */}
        <SettingsExpansionTile
          icon={<MdHistory size={22} />}
          title={t('settings.restore_snapshot', '从快照恢复')}
          subtitle={t('settings.restore_desc', '从系统自动创建的本地快照中恢复数据')}
          nested={true}
        >
            {snapshots.length === 0 ? (
              <div className="settings-empty-hint">{t('settings.no_snapshots_available', '暂无可用快照')}</div>
            ) : (
              snapshots.map(sn => (
                <button key={sn.filename} className="settings-list-tile" onClick={() => handleRestoreSnapshot(sn)} disabled={isImporting}>
                  <div className="settings-list-tile-leading">
                    <MdOutlineArchive size={22} />
                  </div>
                  <div className="settings-list-tile-content">
                    <span className="settings-list-tile-title">{sn.timeLabel}</span>
                    <span className="settings-list-tile-subtitle">{sn.sizeMB} MB</span>
                  </div>
                  <MdChevronRight size={22} className="settings-list-tile-trailing" />
                </button>
              ))
            )}
        </SettingsExpansionTile>
    </SettingsExpansionTile>
  );
};
