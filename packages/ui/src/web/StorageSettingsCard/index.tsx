import React from 'react';
import { useTranslation } from 'react-i18next';
import { MdOutlineFolderShared, MdOutlineFolderDelete, MdChevronRight, MdExpandMore } from 'react-icons/md';
import '../shared/SettingsListTile.css';

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
  storageRootPath = '...',
  onChangeRoot,
}) => {
  const { t } = useTranslation();

  return (
    <details className="settings-expansion-tile">
      <summary className="settings-expansion-summary">
        <div className="settings-list-tile-leading">
          <MdOutlineFolderShared size={24} />
        </div>
        <div className="settings-list-tile-content">
          <span className="settings-list-tile-title">{t('settings.storage_manager', '存储管理')}</span>
          <span className="settings-list-tile-subtitle">{t('settings.storage_root_desc', '管理数据存储路径与附件')}</span>
        </div>
        <MdExpandMore className="settings-expansion-arrow" size={24} />
      </summary>

      <div className="settings-expansion-children">
        {/* 附件管理 - 跳转 */}
        <button className="settings-list-tile">
          <div className="settings-list-tile-leading" />
          <div className="settings-list-tile-content">
            <span className="settings-list-tile-title">{t('settings.attachment_management', '附件管理')}</span>
            <span className="settings-list-tile-subtitle">{t('settings.attachment_management_desc', '管理所有对话附件，支持批次删除')}</span>
          </div>
          <MdChevronRight size={22} className="settings-list-tile-trailing" />
        </button>

        <div className="settings-list-divider indent" />

        {/* 数据根目录 */}
        <div className="settings-list-tile settings-list-tile-noclick">
          <div className="settings-list-tile-leading" />
          <div className="settings-list-tile-content">
            <span className="settings-list-tile-title">{t('settings.storage_root', '数据根目录')}</span>
            <span className="settings-list-tile-subtitle settings-monospace">{storageRootPath}</span>
          </div>
          {onChangeRoot && (
            <button className="settings-text-btn" onClick={onChangeRoot}>
              {t('settings.change_storage_root', '更换目录')}
            </button>
          )}
        </div>
      </div>
    </details>
  );
};
