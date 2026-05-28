import React from 'react'
import {
  Archive,
  CheckSquare,
  CloudUpload,
  HelpCircle,
  Loader2,
  RefreshCw,
  Settings,
  Trash2
} from 'lucide-react'
import styles from './CloudSyncPanel.module.css'
import { Tooltip } from '../Tooltip/Tooltip'
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
    openCountModal
  } = vm

  return (
    <>
      <div className={styles.tabsContainer}>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'cloud' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('cloud')}
        >
          {t('data_sync.cloud_backups_tab', '云端备份')}
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'snapshot' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('snapshot')}
        >
          {t('data_sync.local_snapshots_tab', '本地快照')}
        </button>
      </div>

      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <div className={styles.titleBlock}>
            <span className={styles.titleLabel}>
              {activeTab === 'snapshot'
                ? t('data_sync.local_snapshots', '本地快照')
                : t('data_sync.sync_records', '云端备份')}
            </span>
            <Tooltip
              content={
                activeTab === 'snapshot'
                  ? t(
                      'data_sync.snapshot_tooltip',
                      '本地快照是系统在以下两种情况下自动创建的本地状态备份：1. 还原/导入全量备份前；2. 恢复/应用本地快照前。恢复快照将使您的所有数据、设置和数据库还原到该快照触发生成时刻的状态。'
                    )
                  : t(
                      'data_sync.backup_tooltip',
                      '云端备份为您提供完整的云端历史档案存档。您可以手动或者通过自动策略随时将数据打包上传至指定云存储服务，确保数据绝对防丢。标记为「手动」的存档表示其曾被重命名过，自动清理策略（备份上限设置）不会删除带有「手动」标签的备份记录。'
                    )
              }
            >
              <span className={styles.helpIconWrapper}>
                <HelpCircle size={16} className={styles.helpIcon} />
              </span>
            </Tooltip>
            {activeTab === 'cloud' && (
              <span className={styles.targetBadge}>{config.target.toUpperCase()}</span>
            )}
            <button
              type="button"
              className={styles.refreshBtn}
              onClick={fetchRecords}
              disabled={isLoading}
              title={t('common.refresh', '刷新')}
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        <div className={styles.actionsGroup}>
          {manageMode ? (
            <>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.btnOutlined}`}
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
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.textBtn}`}
                onClick={() => {
                  setManageMode(false)
                  setSelected(new Set())
                }}
              >
                {t('common.cancel', '取消')}
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.btnDangerFilled}`}
                onClick={handleBatchDelete}
                disabled={selected.size === 0}
              >
                <Trash2 size={16} /> {t('common.delete', '删除')} ({selected.size})
              </button>
            </>
          ) : (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.btnOutlined}`}
              onClick={() => setManageMode(true)}
              disabled={records.length === 0 || isLoading}
            >
              <CheckSquare size={16} /> {t('data_sync.batch_manage', '批量管理')}
            </button>
          )}

          {activeTab === 'snapshot' && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.btnOutlined}`}
              onClick={openCountModal}
            >
              <Archive size={16} />{' '}
              {config.maxSnapshotCount === -1
                ? t('data_sync.no_limit', '不限制数量')
                : t('data_sync.max_backup_count_value', '保留: $count').replace(
                    '$count',
                    config.maxSnapshotCount!.toString()
                  )}
            </button>
          )}

          {activeTab === 'cloud' && (
            <>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.btnOutlined}`}
                onClick={openSettings}
              >
                <Settings size={16} /> {t('data_sync.sync_settings_button', '备份设置')}
              </button>

              <button
                type="button"
                className={`${styles.actionBtn} ${styles.btnOutlined}`}
                onClick={openCountModal}
              >
                <Archive size={16} />{' '}
                {config.maxBackupCount === -1
                  ? t('data_sync.no_limit', '不限制数量')
                  : t('data_sync.max_backup_count_value', '保留: $count').replace(
                      '$count',
                      config.maxBackupCount.toString()
                    )}
              </button>

              <button
                type="button"
                className={`${styles.actionBtn} ${styles.btnFilled}`}
                onClick={handleSync}
                disabled={isSyncing || config.target === 'local'}
              >
                {isSyncing ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1.5s linear infinite' }} />{' '}
                    {t('data_sync.syncing_status', '备份中...')}
                  </>
                ) : (
                  <>
                    <CloudUpload size={16} /> {t('data_sync.sync_now_button', '立即备份')}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
