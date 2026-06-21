import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DownloadCloud, Edit3, FileText, Loader2, Package, Trash2 } from 'lucide-react'
import styles from './CloudSyncPanel.module.css'
import type { CloudSyncPanelViewModel } from './useCloudSyncPanel'

export interface CloudSyncRecordListProps {
  vm: CloudSyncPanelViewModel
}

export const CloudSyncRecordList: React.FC<CloudSyncRecordListProps> = ({ vm }) => {
  const {
    t,
    config,
    activeTab,
    records,
    isLoading,
    manageMode,
    selected,
    setSelected,
    handleDownload,
    handleRestore,
    handleRename,
    handleDelete,
    onDownloadBackup
  } = vm

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 0',
            gap: '16px'
          }}
        >
          <Loader2
            size={32}
            style={{
              animation: 'spin 1.5s linear infinite',
              color: 'var(--color-primary, #0ea5e9)'
            }}
          />
          <div style={{ color: 'var(--color-on-surface-variant)', fontSize: 14 }}>
            {activeTab === 'snapshot'
              ? t('data_sync.loading_snapshots', '正在载入本地快照...')
              : t('data_sync.loading_records', '正在连线获取云端记录...')}
          </div>
        </motion.div>
      ) : records.length === 0 ? (
        <motion.div
          key="empty"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 0',
            gap: '8px',
            color: 'var(--color-on-surface-variant)'
          }}
        >
          <Package size={48} strokeWidth={1} style={{ opacity: 0.5, marginBottom: 8 }} />
          {activeTab === 'cloud' && config.target === 'local' ? (
            <div style={{ textAlign: 'center', maxWidth: '380px', lineHeight: '1.5' }}>
              <div>{t('data_sync.local_target_no_cloud_records', '当前备份目标为本地存储。')}</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                {t(
                  'data_sync.local_target_no_cloud_records_desc',
                  '您可切换至「本地快照」标签页管理系统快照，或在「备份设置」中绑定 S3/WebDAV 云端存储。'
                )}
              </div>
            </div>
          ) : (
            <div>
              {activeTab === 'snapshot'
                ? t('data_sync.no_snapshots_hint', '暂无本地快照')
                : t('data_sync.no_records_hint', '暂无云端备份')}
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div
          key="list"
          className={styles.recordList}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {records.map((r) => (
            <div
              key={r.filename}
              className={`${styles.recordItem} ${selected.has(r.filename) ? styles.itemSelected : ''}`}
              onClick={() => {
                if (manageMode) {
                  const next = new Set(selected)
                  selected.has(r.filename) ? next.delete(r.filename) : next.add(r.filename)
                  setSelected(next)
                }
              }}
              style={{ cursor: manageMode ? 'pointer' : 'default' }}
            >
              {manageMode && (
                <input
                  type="checkbox"
                  className={styles.customCheck}
                  checked={selected.has(r.filename)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const next = new Set(selected)
                    e.target.checked ? next.add(r.filename) : next.delete(r.filename)
                    setSelected(next)
                  }}
                />
              )}
              <div
                className={styles.recordIconWrapper}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: 'rgba(14, 165, 233, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary, #0ea5e9)',
                  flexShrink: 0
                }}
              >
                <FileText size={22} strokeWidth={2} />
              </div>
              <div className={styles.recordInfo}>
                <div className={styles.recordName}>
                  {r.filename}
                  {!r.managed && activeTab === 'cloud' && (
                    <span
                      className={styles.unmanagedBadge}
                      title={t('cloud.unmanaged_hint', '此文件不受自动清理管理')}
                    >
                      {t('cloud.unmanaged_label', '手动')}
                    </span>
                  )}
                </div>
                <div className={styles.recordMeta}>
                  {new Date(r.lastModified).toLocaleString()} ·{' '}
                  {(r.sizeInBytes / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
              {!manageMode && (
                <div className={styles.recordActions}>
                  {activeTab === 'cloud' && onDownloadBackup && (
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => handleDownload(r.filename)}
                      title={t('cloud.download_to_local', '下载到本地')}
                    >
                      <DownloadCloud size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtnRestore}`}
                    onClick={() => handleRestore(r.filename)}
                    title={
                      activeTab === 'snapshot'
                        ? t('cloud.restore_snapshot', '覆盖并恢复到本机')
                        : t('cloud.restore_to_local', '覆盖并恢复到本机')
                    }
                  >
                    <Package size={16} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => handleRename(r.filename)}
                    title={t('cloud.rename', '重命名')}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtnDelete}`}
                    onClick={() => handleDelete(r.filename)}
                    title={t('cloud.delete', '删除')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
