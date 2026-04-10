import React from 'react';
import { useTranslation } from 'react-i18next';
import { MdOutlineFolderShared, MdOutlineFolderDelete, MdChevronRight } from 'react-icons/md';
import '../shared/SettingsListTile.css';
import { SettingsExpansionTile } from '../shared/SettingsExpansionTile';

export interface StorageSettingsCardProps {
  storageRootPath?: string;
  sqliteSizeStats: string;
  vectorDbStats: string;
  mediaCacheStats: string;
  totalLimit?: string;
  onChangeRoot?: () => Promise<void>;
  onNavigateToAttachments?: () => void;
  onClearCache?: () => void;
  onVacuumDb?: () => void;
}

export const StorageSettingsCard: React.FC<StorageSettingsCardProps> = ({
  storageRootPath = '...',
  onChangeRoot,
  onNavigateToAttachments,
}) => {
  const { t } = useTranslation();

  return (
    <SettingsExpansionTile
      icon={<MdOutlineFolderShared size={24} />}
      title={t('settings.storage_manager', '存储管理')}
      subtitle={t('settings.storage_root_desc', '管理数据存储路径与附件')}
    >


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
    </SettingsExpansionTile>
  );
};
