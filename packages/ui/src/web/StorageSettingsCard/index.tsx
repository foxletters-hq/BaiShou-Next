import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdOutlineFolderShared } from 'react-icons/md'
import '../shared/SettingsListTile.css'
import './StorageSettingsCard.css'
import { SettingsExpansionTile } from '../shared/SettingsExpansionTile'

export interface StorageSettingsCardProps {
  storageRootPath?: string
  sqliteSizeStats?: string
  vectorDbStats?: string
  mediaCacheStats?: string
  totalLimit?: string
  /** @deprecated 使用 onChangeDirectory */
  onChangeRoot?: () => Promise<void>
  onChangeDirectory?: () => void | Promise<void>
  changeDirectoryLabel?: string
  onMigrateDirectory?: () => void | Promise<void>
  migrateDirectoryLabel?: string
  onNavigateToAttachments?: () => void
  onClearCache?: () => void
  onVacuumDb?: () => void
  onRefreshStats?: () => Promise<any>
}

export const StorageSettingsCard: React.FC<StorageSettingsCardProps> = ({
  storageRootPath = '...',
  onChangeRoot,
  onChangeDirectory,
  changeDirectoryLabel,
  onMigrateDirectory,
  migrateDirectoryLabel,
  onNavigateToAttachments
}) => {
  const { t } = useTranslation()
  const handleChangeDirectory = onChangeDirectory ?? onChangeRoot

  return (
    <SettingsExpansionTile
      icon={<MdOutlineFolderShared size={24} />}
      title={t('settings.storage_manager', '存储管理')}
      subtitle={t('settings.storage_root_desc', '管理数据存储路径与附件')}
    >
      <div className="storage-settings-root-block">
        <div className="settings-list-tile settings-list-tile-noclick">
          <div className="settings-list-tile-leading" />
          <div className="settings-list-tile-content">
            <span className="settings-list-tile-title">
              {t('settings.storage_root', '数据根目录')}
            </span>
            <span className="settings-list-tile-subtitle settings-monospace">
              {storageRootPath}
            </span>
          </div>
        </div>

        {(handleChangeDirectory || onMigrateDirectory) && (
          <div className="storage-settings-actions">
            {onMigrateDirectory ? (
              <button
                type="button"
                className="storage-settings-action-btn storage-settings-action-btn-secondary"
                onClick={() => void onMigrateDirectory()}
              >
                {migrateDirectoryLabel ?? t('storage.migrate_directory', '迁移数据目录')}
              </button>
            ) : null}
            {handleChangeDirectory ? (
              <button
                type="button"
                className="storage-settings-action-btn"
                onClick={() => void handleChangeDirectory()}
              >
                {changeDirectoryLabel ?? t('storage.change_directory', '更换目录')}
              </button>
            ) : null}
          </div>
        )}
      </div>

      {onNavigateToAttachments ? (
        <button type="button" className="settings-text-btn" onClick={onNavigateToAttachments}>
          {t('settings.attachment_management', '附件管理')}
        </button>
      ) : null}
    </SettingsExpansionTile>
  )
}
