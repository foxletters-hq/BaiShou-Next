import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdOutlineFolderShared, MdOutlineFolder } from 'react-icons/md'
import '../shared/SettingsListTile.css'
import './StorageSettingsCard.css'
import { SettingsExpansionTile } from '../shared/SettingsExpansionTile'

export interface StorageSettingsCardProps {
  storageRootPath?: string
  externalJournalsPath?: string | null
  externalJournalsDefaultPath?: string
  externalJournalsFileCount?: number
  externalJournalsPathAvailable?: boolean
  externalSummariesPath?: string | null
  externalSummariesDefaultPath?: string
  externalSummariesFileCount?: number
  externalSummariesFileCounts?: {
    weekly: number
    monthly: number
    quarterly: number
    yearly: number
  }
  externalSummariesPathAvailable?: boolean
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
  onChangeExternalJournalsDirectory?: () => void | Promise<void>
  onClearExternalJournalsDirectory?: () => void | Promise<void>
  onChangeExternalSummariesDirectory?: () => void | Promise<void>
  onClearExternalSummariesDirectory?: () => void | Promise<void>
  onNavigateToAttachments?: () => void
  embedded?: boolean
  isLast?: boolean
  onClearCache?: () => void
  onVacuumDb?: () => void
  onRefreshStats?: () => Promise<any>
}

export const StorageSettingsCard: React.FC<StorageSettingsCardProps> = ({
  storageRootPath = '...',
  externalJournalsPath = null,
  externalJournalsDefaultPath,
  externalJournalsFileCount,
  externalJournalsPathAvailable = true,
  externalSummariesPath = null,
  externalSummariesDefaultPath,
  externalSummariesFileCount,
  externalSummariesFileCounts,
  externalSummariesPathAvailable = true,
  onChangeRoot,
  onChangeDirectory,
  changeDirectoryLabel,
  onMigrateDirectory,
  migrateDirectoryLabel,
  onChangeExternalJournalsDirectory,
  onClearExternalJournalsDirectory,
  onChangeExternalSummariesDirectory,
  onClearExternalSummariesDirectory,
  onNavigateToAttachments,
  embedded = false,
  isLast = false
}) => {
  const { t } = useTranslation()
  const handleChangeDirectory = onChangeDirectory ?? onChangeRoot

  return (
    <SettingsExpansionTile
      embedded={embedded}
      isLast={isLast}
      icon={<MdOutlineFolderShared size={24} />}
      title={t('settings.storage_manager', '存储管理')}
      subtitle={t('settings.storage_root_desc', '管理数据存储路径与附件')}
    >
      <div className="storage-settings-root-block">
        <div className="settings-list-tile settings-list-tile-noclick">
          <div className="settings-list-tile-leading">
            <MdOutlineFolder size={22} />
          </div>
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

      {(onChangeExternalJournalsDirectory || onClearExternalJournalsDirectory) && (
        <div className="storage-settings-root-block">
          <div className="settings-list-tile settings-list-tile-noclick">
            <div className="settings-list-tile-leading">
              <MdOutlineFolder size={22} />
            </div>
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">
                {t('storage.external_journals_title', '外部日记目录')}
              </span>
              <span className="settings-list-tile-subtitle settings-monospace">
                {externalJournalsPath ||
                  externalJournalsDefaultPath ||
                  t('storage.external_journals_default', '使用工作区内 Journals')}
              </span>
              {externalJournalsPath && !externalJournalsPathAvailable ? (
                <span className="settings-list-tile-subtitle storage-settings-warning">
                  {t(
                    'storage.external_path_not_available_on_device',
                    '该路径在本机不可访问（可能来自其他设备的同步配置）'
                  )}
                </span>
              ) : null}
              {typeof externalJournalsFileCount === 'number' ? (
                <span className="settings-list-tile-subtitle">
                  {t('storage.external_journals_scan_count', {
                    count: externalJournalsFileCount,
                    defaultValue: `已识别 {{count}} 篇日记 Markdown`
                  })}
                </span>
              ) : null}
              <span className="settings-list-tile-subtitle">
                {t(
                  'storage.external_journals_hint',
                  '本机读写位置，不会同步到其他设备。云端增量同步以工作区虚拟路径 Personal/Journals 为准。'
                )}
              </span>
            </div>
          </div>

          <div className="storage-settings-actions">
            {onChangeExternalJournalsDirectory ? (
              <button
                type="button"
                className="storage-settings-action-btn"
                onClick={() => void onChangeExternalJournalsDirectory()}
              >
                {t('storage.external_journals_pick', '选择日记目录')}
              </button>
            ) : null}
            {externalJournalsPath && onClearExternalJournalsDirectory ? (
              <button
                type="button"
                className="storage-settings-action-btn storage-settings-action-btn-secondary"
                onClick={() => void onClearExternalJournalsDirectory()}
              >
                {t('storage.external_journals_clear', '恢复默认目录')}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {(onChangeExternalSummariesDirectory || onClearExternalSummariesDirectory) && (
        <div className="storage-settings-root-block">
          <div className="settings-list-tile settings-list-tile-noclick">
            <div className="settings-list-tile-leading">
              <MdOutlineFolder size={22} />
            </div>
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">
                {t('storage.external_summaries_title', '外部总结目录')}
              </span>
              <span className="settings-list-tile-subtitle settings-monospace">
                {externalSummariesPath ||
                  externalSummariesDefaultPath ||
                  t('storage.external_summaries_default', '使用工作区内 Archives')}
              </span>
              {externalSummariesPath && !externalSummariesPathAvailable ? (
                <span className="settings-list-tile-subtitle storage-settings-warning">
                  {t(
                    'storage.external_path_not_available_on_device',
                    '该路径在本机不可访问（可能来自其他设备的同步配置）'
                  )}
                </span>
              ) : null}
              {typeof externalSummariesFileCount === 'number' ? (
                <>
                  <span className="settings-list-tile-subtitle">
                    {t('storage.external_summaries_scan_count', {
                      count: externalSummariesFileCount,
                      defaultValue: `已识别 {{count}} 篇总结 Markdown`
                    })}
                  </span>
                  {externalSummariesFileCounts ? (
                    <span className="settings-list-tile-subtitle">
                      {t('storage.external_summaries_scan_breakdown', {
                        weekly: externalSummariesFileCounts.weekly,
                        monthly: externalSummariesFileCounts.monthly,
                        quarterly: externalSummariesFileCounts.quarterly,
                        yearly: externalSummariesFileCounts.yearly,
                        defaultValue:
                          '其中周记 {{weekly}} · 月记 {{monthly}} · 季报 {{quarterly}} · 年记 {{yearly}}'
                      })}
                    </span>
                  ) : null}
                </>
              ) : null}
              <span className="settings-list-tile-subtitle">
                {t(
                  'storage.external_summaries_hint',
                  '本机读写位置，不会同步到其他设备。云端以工作区虚拟路径 Personal/Archives 为准。'
                )}
              </span>
            </div>
          </div>

          <div className="storage-settings-actions">
            {onChangeExternalSummariesDirectory ? (
              <button
                type="button"
                className="storage-settings-action-btn"
                onClick={() => void onChangeExternalSummariesDirectory()}
              >
                {t('storage.external_summaries_pick', '选择总结目录')}
              </button>
            ) : null}
            {externalSummariesPath && onClearExternalSummariesDirectory ? (
              <button
                type="button"
                className="storage-settings-action-btn storage-settings-action-btn-secondary"
                onClick={() => void onClearExternalSummariesDirectory()}
              >
                {t('storage.external_summaries_clear', '恢复默认目录')}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {onNavigateToAttachments ? (
        <button type="button" className="settings-text-btn" onClick={onNavigateToAttachments}>
          {t('settings.attachment_management', '附件管理')}
        </button>
      ) : null}
    </SettingsExpansionTile>
  )
}
