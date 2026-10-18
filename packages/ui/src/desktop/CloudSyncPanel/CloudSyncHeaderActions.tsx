import React from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '../Button/Button'
import styles from './CloudSyncPanel.module.css'
import { SegmentedControl } from '../shared/SegmentedControl'
import { HelpTooltip } from '../HelpTooltip'
import type { CloudSyncPanelViewModel } from './useCloudSyncPanel'

export interface CloudSyncHeaderActionsProps {
  vm: CloudSyncPanelViewModel
}

export const CloudSyncHeaderActions: React.FC<CloudSyncHeaderActionsProps> = ({ vm }) => {
  const {
    t,
    config,
    activeTab,
    setActiveTab,
    records,
    isLoading,
    isSyncing,
    manageMode,
    setManageMode,
    selected,
    setSelected,
    fetchRecords,
    handleBatchDelete,
    handleSync,
    openSettings,
    openCountModal,
    onExportZip,
    onImportZip,
    onPickArchiveFile
  } = vm

  const showLocalArchive = Boolean(onExportZip && onImportZip && onPickArchiveFile)

  const titleLabel =
    activeTab === 'snapshot'
      ? t('data_sync.local_snapshots', '本地快照')
      : activeTab === 'local'
        ? t('settings.local_archive_backup', '本地全量备份')
        : t('data_sync.sync_records', '云端备份')

  const helpContent =
    activeTab === 'snapshot'
      ? t(
          'data_sync.snapshot_tooltip',
          '关键操作前自动生成的本地状态快照，相当于你的「安全后悔药」。\n\n• 触发时机：在还原全量备份或应用其他快照前，系统会自动备份当前状态\n• 一键撤销：若还原后数据不符合预期，可随时通过快照一键回退到操作前\n• 仅存本地：快照保存在本机设备上，不消耗云存储空间与流量'
        )
      : activeTab === 'local'
        ? t(
            'settings.local_archive_backup_desc',
            '导出或导入包含全部数据的 ZIP 文件，适合换机或离线备份'
          )
        : t(
            'data_sync.backup_tooltip',
            '将所有日记、设置与数据库打包上传至云存储，作为完整历史存档。\n\n• 手动保护：重命名任意备份即可标记为「手动」，永久保留，不受自动清理影响\n• 自动清理：备份超出保留数量时，系统只会自动清理未标记的普通备份'
          )

  return (
    <>
      <div className={styles.tabsToolbarRow}>
        <SegmentedControl
          value={activeTab}
          options={[
            { value: 'cloud', label: t('data_sync.cloud_backups_tab', '云端备份') },
            { value: 'snapshot', label: t('data_sync.local_snapshots_tab', '本地快照') },
            ...(showLocalArchive
              ? [
                  {
                    value: 'local' as const,
                    label: t('data_sync.local_backup_tab', '本地备份')
                  }
                ]
              : [])
          ]}
          onChange={setActiveTab}
        />
      </div>

      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <div className={styles.titleBlock}>
            <span className={styles.titleLabel}>{titleLabel}</span>
            <HelpTooltip content={helpContent} size={16} />
            {activeTab === 'cloud' && (
              <span className={styles.targetBadge}>{config.target.toUpperCase()}</span>
            )}
            {activeTab !== 'local' && (
              <button
                type="button"
                className={styles.refreshBtn}
                onClick={fetchRecords}
                disabled={isLoading}
                title={t('common.refresh', '刷新')}
              >
                <RefreshCw size={16} />
              </button>
            )}
          </div>
        </div>

        {activeTab !== 'local' ? (
          <div className={styles.actionsGroup}>
            {manageMode ? (
              <>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    if (selected.size === records.length) {
                      setSelected(new Set())
                    } else {
                      setSelected(new Set(records.map((r) => r.filename)))
                    }
                  }}
                >
                  {selected.size === records.length
                    ? t('settings.attachment_deselect_all', '取消全选')
                    : t('settings.attachment_select_all', '全选')}
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setManageMode(false)
                    setSelected(new Set())
                  }}
                >
                  {t('common.cancel', '取消')}
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  onClick={handleBatchDelete}
                  disabled={selected.size === 0}
                >
                  {t('common.delete', '删除')} ({selected.size})
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outlined"
                size="small"
                onClick={() => setManageMode(true)}
                disabled={records.length === 0 || isLoading}
              >
                {t('data_sync.batch_manage', '批量管理')}
              </Button>
            )}

            {activeTab === 'snapshot' && (
              <Button type="button" variant="outlined" size="small" onClick={openCountModal}>
                {config.maxSnapshotCount === -1
                  ? t('data_sync.no_limit', '不限制数量')
                  : t('data_sync.max_backup_count_value', '保留: $count').replace(
                      '$count',
                      config.maxSnapshotCount!.toString()
                    )}
              </Button>
            )}

            {activeTab === 'cloud' && (
              <>
                <Button type="button" variant="outlined" size="small" onClick={openSettings}>
                  {t('data_sync.sync_settings_button', '备份设置')}
                </Button>

                <Button type="button" variant="outlined" size="small" onClick={openCountModal}>
                  {config.maxBackupCount === -1
                    ? t('data_sync.no_limit', '不限制数量')
                    : t('data_sync.max_backup_count_value', '保留: $count').replace(
                        '$count',
                        config.maxBackupCount.toString()
                      )}
                </Button>

                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  onClick={handleSync}
                  disabled={config.target === 'local'}
                  isLoading={isSyncing}
                >
                  {t('data_sync.sync_now_button', '立即备份')}
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </>
  )
}
