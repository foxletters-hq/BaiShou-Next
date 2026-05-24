import React, { useState, useEffect, useCallback } from 'react'
import styles from './CloudSyncPanel.module.css'
import { useTranslation } from 'react-i18next'
import { useToast } from '../Toast/useToast'
import { useDialog } from '../Dialog'
import {
  Cloud,
  Globe,
  Folder,
  Database,
  History,
  RefreshCw,
  Trash2,
  CheckSquare,
  Settings,
  Archive,
  CloudUpload,
  ArrowLeft,
  Save,
  Home,
  Package,
  DownloadCloud,
  Edit3,
  Loader2,
  Component,
  Map,
  Key,
  Eye,
  EyeOff,
  LayoutTemplate,
  FileText
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export type SyncTarget = 'local' | 's3' | 'webdav'

export interface SyncConfig {
  target: SyncTarget
  maxBackupCount: number
  maxSnapshotCount?: number
  webdavUrl: string
  webdavUsername: string
  webdavPassword: string
  webdavPath: string
  s3Endpoint: string
  s3Region: string
  s3Bucket: string
  s3Path: string
  s3AccessKey: string
  s3SecretKey: string
}

export interface SyncRecord {
  filename: string
  lastModified: string
  sizeInBytes: number
  managed: boolean
}

export interface CloudSyncPanelProps {
  onSyncNow: (config: SyncConfig) => Promise<{ success: boolean; message: string }>
  onListRecords: (config: SyncConfig) => Promise<SyncRecord[]>
  onRestore: (
    config: SyncConfig,
    filename: string
  ) => Promise<{ success: boolean; message: string }>
  onDownloadBackup?: (
    config: SyncConfig,
    filename: string
  ) => Promise<{ success: boolean; message: string }>
  onDeleteRecord: (config: SyncConfig, filename: string) => Promise<boolean>
  onBatchDelete: (config: SyncConfig, filenames: string[]) => Promise<number>
  onRename: (config: SyncConfig, oldName: string, newName: string) => Promise<boolean>
  savedConfig?: SyncConfig
  onSaveConfig?: (config: SyncConfig) => void

  // Local Snapshot additions
  onListSnapshots?: () => Promise<SyncRecord[]>
  onRestoreSnapshot?: (filename: string) => Promise<{ success: boolean; message: string }>
  onDeleteSnapshot?: (filename: string) => Promise<boolean>
  onBatchDeleteSnapshots?: (filenames: string[]) => Promise<number>
  onRenameSnapshot?: (oldName: string, newName: string) => Promise<boolean>
}

const DEFAULT_CONFIG: SyncConfig = {
  target: 'local',
  maxBackupCount: 20,
  maxSnapshotCount: 5,
  webdavUrl: 'https://',
  webdavUsername: '',
  webdavPassword: '',
  webdavPath: '/baishou_backup',
  s3Endpoint: 'https://',
  s3Region: '',
  s3Bucket: '',
  s3Path: '/baishou_backup',
  s3AccessKey: '',
  s3SecretKey: ''
}

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--text-secondary)',
  display: 'block',
  marginBottom: 4
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border-muted)',
  borderRadius: '6px',
  background: 'var(--bg-surface-low)',
  color: 'var(--text-primary)',
  fontSize: '13px',
  boxSizing: 'border-box'
}

export const CloudSyncPanel: React.FC<CloudSyncPanelProps> = ({
  onSyncNow,
  onListRecords,
  onRestore,
  onDownloadBackup,
  onDeleteRecord,
  onBatchDelete,
  onRename,
  savedConfig,
  onSaveConfig,

  onListSnapshots,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onBatchDeleteSnapshots,
  onRenameSnapshot
}) => {
  const { t } = useTranslation()
  const toast = useToast()
  const dialog = useDialog()
  const [config, setConfig] = useState<SyncConfig>({
    ...DEFAULT_CONFIG,
    ...(savedConfig || {})
  })
  const [records, setRecords] = useState<SyncRecord[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [manageMode, setManageMode] = useState(false)
  const [showCountModal, setShowCountModal] = useState(false)
  const [tempCount, setTempCount] = useState(config.maxBackupCount)
  const [activeTab, setActiveTab] = useState<'cloud' | 'snapshot'>('cloud')

  const fetchRecords = useCallback(async () => {
    if (activeTab === 'snapshot') {
      if (!onListSnapshots) return
      setIsLoading(true)
      try {
        const r = await onListSnapshots()
        setRecords(r)
      } catch (e: any) {
        toast.showError(
          t('cloud.fetch_snapshot_list_failed', '获取本地快照列表失败: ') + (e.message || e)
        )
      } finally {
        setIsLoading(false)
        setManageMode(false)
        setSelected(new Set())
      }
      return
    }

    if (config.target === 'local') {
      setRecords([])
      return
    }
    setIsLoading(true)
    try {
      const r = await onListRecords(config)
      setRecords(r)
    } catch (e: any) {
      toast.showError(t('cloud.fetch_backup_list_failed', '获取备份列表失败: ') + (e.message || e))
    } finally {
      setIsLoading(false)
      setManageMode(false)
      setSelected(new Set())
    }
  }, [config, activeTab, onListRecords, onListSnapshots, toast, t])

  // Keep config in sync if savedConfig is loaded asynchronously or updated externally
  useEffect(() => {
    if (savedConfig) {
      const next = { ...DEFAULT_CONFIG, ...savedConfig }
      setConfig(next)
      if (activeTab === 'cloud') {
        if (next.target !== 'local') {
          setIsLoading(true)
          onListRecords(next)
            .then((r) => setRecords(r))
            .catch((e) =>
              toast.showError(
                t('cloud.fetch_backup_list_failed', '获取备份列表失败: ') + (e.message || e)
              )
            )
            .finally(() => {
              setIsLoading(false)
              setManageMode(false)
              setSelected(new Set())
            })
        } else {
          setRecords([])
        }
      } else {
        if (onListSnapshots) {
          setIsLoading(true)
          onListSnapshots()
            .then((r) => setRecords(r))
            .catch((e) =>
              toast.showError(
                t('cloud.fetch_snapshot_list_failed', '获取本地快照列表失败: ') + (e.message || e)
              )
            )
            .finally(() => {
              setIsLoading(false)
              setManageMode(false)
              setSelected(new Set())
            })
        }
      }
    }
  }, [savedConfig, activeTab, onListRecords, onListSnapshots, toast, t])

  const handleSaveConfig = () => {
    onSaveConfig?.(config)
    setShowConfig(false)
    fetchRecords()
  }

  useEffect(() => {
    fetchRecords()
  }, [activeTab, fetchRecords])

  const handleSync = async () => {
    if (config.target === 'local') {
      toast.show(t('cloud.sync_target_local_hint', '当前同步目标为本地，请先配置云端'))
      return
    }
    setIsSyncing(true)
    try {
      const res = await onSyncNow(config)
      if (res.success) toast.showSuccess(res.message)
      else toast.showError(res.message)
      if (res.success) await fetchRecords()
    } finally {
      setIsSyncing(false)
    }
  }

  const handleRestore = async (filename: string) => {
    const confirmed = await dialog.confirm(
      activeTab === 'snapshot'
        ? t(
            'sync.restore_snapshot_confirm_msg',
            `确定要从本地快照 ${filename} 恢复吗？\n当前本地数据将被覆盖。`
          )
        : t('sync.restore_confirm_msg', `确定要恢复备份 ${filename} 吗？\n当前本地数据将被覆盖。`)
    )
    if (!confirmed) return
    setIsSyncing(true)
    try {
      const res =
        activeTab === 'snapshot'
          ? onRestoreSnapshot
            ? await onRestoreSnapshot(filename)
            : { success: false, message: '未实现快照还原' }
          : await onRestore(config, filename)
      if (res.success) toast.showSuccess(res.message)
      else toast.showError(res.message)
      if (res.success) {
        setTimeout(() => window.location.reload(), 1500)
      }
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDownload = async (filename: string) => {
    if (!onDownloadBackup) return
    setIsSyncing(true)
    try {
      const res = await onDownloadBackup(config, filename)
      if (res.success) toast.showSuccess(res.message)
      else toast.showError(res.message)
    } catch (e: any) {
      toast.showError(t('cloud.download_failed', '下载失败: ') + (e.message || e))
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDelete = async (filename: string) => {
    const confirmed =
      activeTab === 'snapshot'
        ? await dialog.confirm(
            t('sync.delete_snapshot_confirm', `真的要删除本地快照 "${filename}" 吗？`)
          )
        : await dialog.confirm(t('sync.delete_confirm', `真的要删除云端备份 "${filename}" 吗？`))
    if (!confirmed) return
    try {
      if (activeTab === 'snapshot') {
        if (onDeleteSnapshot) await onDeleteSnapshot(filename)
      } else {
        await onDeleteRecord(config, filename)
      }
      await fetchRecords()
      toast.showSuccess(t('cloud.delete_success', '删除成功'))
    } catch (e: any) {
      toast.showError(t('cloud.delete_failed', '删除失败: ') + e.message)
    }
  }

  const handleBatchDelete = async () => {
    if (selected.size === 0) return
    const confirmed =
      activeTab === 'snapshot'
        ? await dialog.confirm(
            t(
              'sync.bulk_delete_snapshot_confirm',
              `是否彻底删除选定的 ${selected.size} 个本地快照？此操作不可逆。`
            )
          )
        : await dialog.confirm(
            t(
              'sync.bulk_delete_confirm',
              `是否彻底删除选定的 ${selected.size} 个备份档案？此操作不可逆。`
            )
          )
    if (!confirmed) return
    try {
      if (activeTab === 'snapshot') {
        if (onBatchDeleteSnapshots) await onBatchDeleteSnapshots(Array.from(selected))
      } else {
        await onBatchDelete(config, Array.from(selected))
      }
      await fetchRecords()
      toast.showSuccess(t('cloud.batch_delete_success', '批量删除成功'))
    } catch (e: any) {
      toast.showError(t('cloud.batch_delete_failed', '批量删除失败: ') + e.message)
    }
  }

  const handleRename = async (oldName: string) => {
    const newName = await dialog.prompt(t('cloud.rename', '重命名'), oldName)
    if (!newName || newName === oldName) return
    try {
      if (activeTab === 'snapshot') {
        if (onRenameSnapshot) await onRenameSnapshot(oldName, newName)
      } else {
        await onRename(config, oldName, newName)
      }
      await fetchRecords()
      toast.showSuccess(t('cloud.rename_success', '重命名成功'))
    } catch (e: any) {
      toast.showError(t('cloud.rename_failed', '重命名失败: ') + e.message)
    }
  }

  const totalSizeMb = records.reduce((sum, r) => sum + r.sizeInBytes, 0) / (1024 * 1024)
  const sizeString = totalSizeMb > 0 ? totalSizeMb.toFixed(2) + ' MB' : '0 MB'

  const updateField = (key: keyof SyncConfig, value: any) => {
    const next = { ...config, [key]: value }
    setConfig(next)
    onSaveConfig?.(next) // Auto-save to prevent data loss on tab switch
  }

  const getTargetIcon = (target: string) => {
    if (target === 's3') return <Cloud size={24} strokeWidth={1.5} />
    if (target === 'webdav') return <Globe size={24} strokeWidth={1.5} />
    return <Folder size={24} strokeWidth={1.5} />
  }

  const getTargetColor = (target: string) => {
    if (target === 's3') return '#0ea5e9' // blue
    if (target === 'webdav') return '#8b5cf6' // purple
    return '#64748b' // slate
  }

  const [showPassword, setShowPassword] = useState(false)

  return (
    <AnimatePresence mode="wait">
      {showConfig ? (
        <motion.div
          key="config"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.2 }}
          className={styles.container}
          style={{ padding: 0 }}
        >
          <div className={styles.configPageWrapper}>
            <div className={styles.configAppBar}>
              <button className={styles.configBackButton} onClick={() => setShowConfig(false)}>
                <ArrowLeft size={24} />
              </button>
              <div className={styles.configAppTitle}>
                {t('data_sync.config_title', '数据备份配置')}
              </div>
              <div style={{ width: 40 }} /> {/* spacer for centering */}
            </div>

            <div className={styles.configContent}>
              <div className={styles.targetSectionTitle}>
                {t('data_sync.select_target_title', '选择备份目标')}
              </div>
              <div className={styles.targetCardsLayout}>
                <div
                  className={`${styles.targetCardBig} ${config.target === 'local' ? styles.targetCardSelected : ''}`}
                  onClick={() => updateField('target', 'local')}
                >
                  <div className={styles.targetCardIcon}>
                    <Folder size={24} />
                  </div>
                  <div className={styles.targetCardContent}>
                    <div className={styles.targetCardTitle}>
                      {t('data_sync.target_local', '本地存储')}
                    </div>
                    <div className={styles.targetCardDesc}>
                      {t(
                        'data_sync.local_storage_desc',
                        '直接将备份转储保存在应用所运行设备的本地磁盘中。'
                      )}
                    </div>
                  </div>
                </div>
                <div
                  className={`${styles.targetCardBig} ${config.target === 's3' ? styles.targetCardSelected : ''}`}
                  onClick={() => updateField('target', 's3')}
                >
                  <div className={styles.targetCardIcon}>
                    <Cloud size={24} />
                  </div>
                  <div className={styles.targetCardContent}>
                    <div className={styles.targetCardTitle}>
                      {t('data_sync.target_s3', 'S3 兼容存储')}
                    </div>
                    <div className={styles.targetCardDesc}>
                      {t('data_sync.s3_storage_desc', '兼容 S3 协议的对象存储服务')}
                    </div>
                  </div>
                </div>
                <div
                  className={`${styles.targetCardBig} ${config.target === 'webdav' ? styles.targetCardSelected : ''}`}
                  onClick={() => updateField('target', 'webdav')}
                >
                  <div className={styles.targetCardIcon}>
                    <Globe size={24} />
                  </div>
                  <div className={styles.targetCardContent}>
                    <div className={styles.targetCardTitle}>
                      {t('data_sync.target_webdav', 'WebDAV')}
                    </div>
                    <div className={styles.targetCardDesc}>
                      {t('data_sync.webdav_storage_desc', '通用网络文件存储协议')}
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.configSection}>
                <div className={styles.configSectionHeader}>
                  <div className={styles.configSectionTitle}>
                    {config.target === 'local'
                      ? t('data_sync.s3_config_title', '本地存储配置').replace(
                          'S3',
                          t('data_sync.local_storage', '本地存储')
                        )
                      : config.target === 's3'
                        ? t('data_sync.s3_config_title', 'S3 存储配置')
                        : t('data_sync.webdav_config_title', 'WebDAV 存储配置')}
                  </div>
                </div>
                <div className={styles.formDivider} />

                {config.target === 'local' && (
                  <div className={styles.emptyLocalState}>
                    <div
                      style={{
                        marginBottom: 12,
                        color: 'var(--color-on-surface-variant)'
                      }}
                    >
                      <Home size={64} strokeWidth={1} style={{ opacity: 0.5 }} />
                    </div>
                    <div>
                      {t(
                        'data_sync.local_no_config',
                        '当前模式下产生的数据仅会存放于本地应用目录中，无需输入远程凭据。'
                      )}
                    </div>
                  </div>
                )}

                {config.target === 'webdav' && (
                  <div className={styles.configGrid}>
                    <div className={styles.formField}>
                      <label style={labelStyle}>
                        {t('data_sync.webdav_url_label', 'WebDAV URL 地址')}
                      </label>
                      <input
                        style={inputStyle}
                        value={config.webdavUrl}
                        onChange={(e) => updateField('webdavUrl', e.target.value)}
                      />
                    </div>
                    <div className={styles.formField}>
                      <label style={labelStyle}>
                        {t('data_sync.webdav_path_label', 'Base Path 子路径')}
                      </label>
                      <input
                        style={inputStyle}
                        value={config.webdavPath}
                        onChange={(e) => updateField('webdavPath', e.target.value)}
                      />
                    </div>
                    <div className={styles.formField}>
                      <label style={labelStyle}>
                        {t('data_sync.webdav_user_label', 'Username 用户名')}
                      </label>
                      <input
                        style={inputStyle}
                        value={config.webdavUsername}
                        onChange={(e) => updateField('webdavUsername', e.target.value)}
                      />
                    </div>
                    <div className={styles.formField}>
                      <label style={labelStyle}>
                        {t('data_sync.webdav_password_label', 'Password 密码')}
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          style={{ ...inputStyle, paddingRight: 36 }}
                          value={config.webdavPassword}
                          onChange={(e) => updateField('webdavPassword', e.target.value)}
                        />
                        <button
                          style={{
                            position: 'absolute',
                            right: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            border: 'none',
                            background: 'none',
                            color: 'var(--text-tertiary)',
                            cursor: 'pointer',
                            padding: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {config.target === 's3' && (
                  <div className={styles.configGrid}>
                    <div className={styles.formField}>
                      <label style={labelStyle}>
                        {t('data_sync.s3_endpoint_label', 'Endpoint 服务地址')}
                      </label>
                      <input
                        style={inputStyle}
                        value={config.s3Endpoint}
                        onChange={(e) => updateField('s3Endpoint', e.target.value)}
                      />
                    </div>
                    <div className={styles.formField}>
                      <label style={labelStyle}>
                        {t('data_sync.s3_region_label', 'Region 区域名')}
                      </label>
                      <input
                        style={inputStyle}
                        value={config.s3Region}
                        onChange={(e) => updateField('s3Region', e.target.value)}
                      />
                    </div>
                    <div className={styles.formField}>
                      <label style={labelStyle}>
                        {t('data_sync.s3_bucket_label', 'Bucket 存储桶')}
                      </label>
                      <input
                        style={inputStyle}
                        value={config.s3Bucket}
                        onChange={(e) => updateField('s3Bucket', e.target.value)}
                      />
                    </div>
                    <div className={styles.formField}>
                      <label style={labelStyle}>
                        {t('data_sync.s3_path_label', 'Path 子路径')}
                      </label>
                      <input
                        style={inputStyle}
                        value={config.s3Path}
                        onChange={(e) => updateField('s3Path', e.target.value)}
                      />
                    </div>
                    <div className={styles.formField}>
                      <label style={labelStyle}>
                        {t('data_sync.s3_ak_label', 'Access Key (AK)')}
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          style={{ ...inputStyle, paddingRight: 36 }}
                          value={config.s3AccessKey}
                          onChange={(e) => updateField('s3AccessKey', e.target.value)}
                        />
                        <button
                          style={{
                            position: 'absolute',
                            right: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            border: 'none',
                            background: 'none',
                            color: 'var(--text-tertiary)',
                            cursor: 'pointer',
                            padding: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div className={styles.formField}>
                      <label style={labelStyle}>
                        {t('data_sync.s3_sk_label', 'Secret Key (SK)')}
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          style={{ ...inputStyle, paddingRight: 36 }}
                          value={config.s3SecretKey}
                          onChange={(e) => updateField('s3SecretKey', e.target.value)}
                        />
                        <button
                          style={{
                            position: 'absolute',
                            right: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            border: 'none',
                            background: 'none',
                            color: 'var(--text-tertiary)',
                            cursor: 'pointer',
                            padding: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className={styles.configSectionFooter}>
                  <button
                    className={`${styles.actionBtn} ${styles.btnSave}`}
                    onClick={handleSaveConfig}
                  >
                    {t('data_sync.save_config_button', '保存配置')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="status"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.2 }}
          className={styles.container}
        >
          <div className={styles.statCardsRow}>
            <div className={styles.statCard}>
              <div
                className={styles.statIconWrapper}
                style={{
                  backgroundColor: `${getTargetColor(config.target)}15`,
                  color: getTargetColor(config.target)
                }}
              >
                {getTargetIcon(config.target)}
              </div>
              <div className={styles.statInfo}>
                <div className={styles.statLabel}>
                  {t('data_sync.sync_target', '备份目标 (Target)')}
                </div>
                <div className={styles.statValue}>{config.target.toUpperCase()}</div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div
                className={styles.statIconWrapper}
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981'
                }}
              >
                <Database size={24} strokeWidth={1.5} />
              </div>
              <div className={styles.statInfo}>
                <div className={styles.statLabel}>
                  {activeTab === 'snapshot'
                    ? t('data_sync.total_snapshot_size', '总快照大小')
                    : t('data_sync.total_backup_size', '总备份大小')}
                </div>
                <div className={styles.statValue}>{sizeString}</div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div
                className={styles.statIconWrapper}
                style={{
                  backgroundColor: 'rgba(168, 85, 247, 0.1)',
                  color: '#a855f7'
                }}
              >
                <History size={24} strokeWidth={1.5} />
              </div>
              <div className={styles.statInfo}>
                <div className={styles.statLabel}>
                  {activeTab === 'snapshot'
                    ? t('data_sync.snapshot_count', '快照数量')
                    : t('data_sync.backup_count', '备份数量')}
                </div>
                <div className={styles.statValue}>
                  {records.length}{' '}
                  <span style={{ fontSize: 14, fontWeight: 'normal' }}>
                    {t('common.copies_unit', '份')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 标签页切换按钮 */}
          <div className={styles.tabsContainer}>
            <button
              className={`${styles.tabButton} ${activeTab === 'cloud' ? styles.tabButtonActive : ''}`}
              onClick={() => setActiveTab('cloud')}
            >
              {t('data_sync.cloud_backups_tab', '云端备份')}
            </button>
            <button
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
                {activeTab === 'cloud' && (
                  <span className={styles.targetBadge}>{config.target.toUpperCase()}</span>
                )}
                <button
                  className={styles.refreshBtn}
                  onClick={fetchRecords}
                  disabled={isLoading}
                  title={t('common.refresh', '刷新')}
                >
                  <RefreshCw size={18} />
                </button>
              </div>
              <span className={styles.subtitle}>
                {activeTab === 'snapshot'
                  ? t(
                      'data_sync.snapshots_scope_hint',
                      '系统在还原备份等重大变动前自动生成本地快照，方便数据回滚。'
                    )
                  : t('data_sync.records_scope_hint', '所选节点范围内的全部记录档案。')}
              </span>
            </div>

            <div className={styles.actionsGroup}>
              {manageMode ? (
                <>
                  <button
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
                    className={`${styles.actionBtn} ${styles.textBtn}`}
                    onClick={() => {
                      setManageMode(false)
                      setSelected(new Set())
                    }}
                  >
                    {t('common.cancel', '取消')}
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.btnDangerFilled}`}
                    onClick={handleBatchDelete}
                    disabled={selected.size === 0}
                  >
                    <Trash2 size={16} /> {t('common.delete', '删除')} ({selected.size})
                  </button>
                </>
              ) : (
                <button
                  className={`${styles.actionBtn} ${styles.btnOutlined}`}
                  onClick={() => setManageMode(true)}
                  disabled={records.length === 0 || isLoading}
                >
                  <CheckSquare size={16} /> {t('data_sync.batch_manage', '批量管理')}
                </button>
              )}

              {activeTab === 'snapshot' && (
                <button
                  className={`${styles.actionBtn} ${styles.btnOutlined}`}
                  onClick={() => {
                    setTempCount(config.maxSnapshotCount === -1 ? 5 : config.maxSnapshotCount)
                    setShowCountModal(true)
                  }}
                >
                  <Archive size={16} />{' '}
                  {config.maxSnapshotCount === -1
                    ? t('data_sync.no_limit', '不限制数量')
                    : t('data_sync.max_backup_count_value', '保留: $count').replace(
                        '$count',
                        config.maxSnapshotCount.toString()
                      )}
                </button>
              )}

              {activeTab === 'cloud' && (
                <>
                  <button
                    className={`${styles.actionBtn} ${styles.btnOutlined}`}
                    onClick={() => {
                      setConfig({ ...DEFAULT_CONFIG, ...(savedConfig || {}) })
                      setShowConfig(true)
                    }}
                  >
                    <Settings size={16} /> {t('data_sync.sync_settings_button', '备份设置')}
                  </button>

                  <button
                    className={`${styles.actionBtn} ${styles.btnOutlined}`}
                    onClick={() => {
                      setTempCount(config.maxBackupCount === -1 ? 20 : config.maxBackupCount)
                      setShowCountModal(true)
                    }}
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

          {isLoading ? (
            <div
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
              <div
                style={{
                  color: 'var(--color-on-surface-variant)',
                  fontSize: 14
                }}
              >
                {activeTab === 'snapshot'
                  ? t('data_sync.loading_snapshots', '正在载入本地快照...')
                  : t('data_sync.loading_records', '正在连线获取云端记录...')}
              </div>
            </div>
          ) : records.length === 0 ? (
            <div
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
                <div
                  style={{
                    textAlign: 'center',
                    maxWidth: '380px',
                    lineHeight: '1.5'
                  }}
                >
                  <div>
                    {t('data_sync.local_target_no_cloud_records', '当前备份目标为本地存储。')}
                  </div>
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
            </div>
          ) : (
            <div className={styles.recordList}>
              {records.map((r) => (
                <div
                  key={r.filename}
                  className={`${styles.recordItem} ${selected.has(r.filename) ? styles.itemSelected : ''}`}
                >
                  {manageMode && (
                    <input
                      type="checkbox"
                      className={styles.customCheck}
                      checked={selected.has(r.filename)}
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
                          className={`${styles.iconBtn}`}
                          onClick={() => handleDownload(r.filename)}
                          title={t('cloud.download_to_local', '下载到本地')}
                        >
                          <DownloadCloud size={16} />
                        </button>
                      )}
                      <button
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
                        className={styles.iconBtn}
                        onClick={() => handleRename(r.filename)}
                        title={t('cloud.rename', '重命名')}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
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
            </div>
          )}

          {showCountModal && (
            <div className={styles.modalOverlay} onClick={() => setShowCountModal(false)}>
              <div className={styles.countModal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.countModalHeader}>
                  <div
                    className={styles.countModalTitleRow}
                    style={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div
                      className={styles.countModalTitleBlock}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Archive size={20} color="var(--color-primary, #0ea5e9)" />
                      <span
                        className={styles.countModalTitle}
                        style={{ fontWeight: 'bold', fontSize: 16 }}
                      >
                        {activeTab === 'snapshot'
                          ? t('data_sync.max_snapshot_title', '快照上限设置')
                          : t('data_sync.max_backup_title', '备份上限设置')}
                      </span>
                    </div>
                    <input
                      type="text"
                      className={styles.smNumberInput}
                      style={{
                        width: 72,
                        padding: '4px 8px',
                        border:
                          '1px solid rgba(var(--color-outline-variant-rgb, 200, 200, 200), 0.5)',
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        textAlign: 'center',
                        background: 'var(--bg-surface-lowest, #f8fafc)',
                        outline: 'none'
                      }}
                      value={tempCount === -1 ? t('data_sync.no_limit', '不限制') : tempCount}
                      onChange={(e) => {
                        const val = e.target.value.trim()
                        if (
                          val === '' ||
                          val === '不限制' ||
                          val === '不限制数量' ||
                          val === '∞' ||
                          val === '-1'
                        ) {
                          setTempCount(-1)
                        } else {
                          const num = parseInt(val)
                          if (!isNaN(num)) {
                            setTempCount(Math.min(100, Math.max(1, num)))
                          }
                        }
                      }}
                      onBlur={() => {
                        if (tempCount !== -1) {
                          setTempCount(Math.min(100, Math.max(1, tempCount)))
                        }
                      }}
                    />
                  </div>
                </div>

                <div
                  className={styles.countModalBody}
                  style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  <div
                    className={styles.countModalDesc}
                    style={{
                      fontSize: 13,
                      color: 'var(--color-on-surface-variant)',
                      lineHeight: 1.5
                    }}
                  >
                    {activeTab === 'snapshot'
                      ? t(
                          'data_sync.max_snapshot_desc',
                          '超过上限后，自动生成新快照时将清理最早的历史快照。'
                        )
                      : t(
                          'data_sync.max_backup_desc',
                          '超过上限后，同步备份时将自动删除最早的备份文件。'
                        )}
                  </div>

                  <div className={styles.smSliderContainer}>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={tempCount === -1 ? 50 : tempCount}
                      onChange={(e) => setTempCount(parseInt(e.target.value))}
                      className={styles.smSlider}
                      style={{
                        backgroundSize: `${tempCount === -1 ? 100 : ((tempCount - 1) * 100) / 49}% 100%`
                      }}
                    />
                  </div>

                  <div
                    className={styles.chipsContainer}
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginTop: 8
                    }}
                  >
                    {[1, 2, 3, 5, 10, 15, -1].map((val) => (
                      <button
                        key={val}
                        className={`${styles.chipItem} ${tempCount === val ? styles.chipItemActive : ''}`}
                        onClick={() => setTempCount(val)}
                        style={{
                          background:
                            tempCount === val
                              ? 'var(--color-primary, #0ea5e9)'
                              : 'var(--bg-surface-normal, #f1f5f9)',
                          color:
                            tempCount === val
                              ? 'var(--text-on-primary, #fff)'
                              : 'var(--text-secondary, #64748b)',
                          border:
                            tempCount === val
                              ? '1px solid var(--color-primary, #0ea5e9)'
                              : '1px solid var(--border-subtle, #e2e8f0)',
                          padding: '6px 12px',
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {val === -1
                          ? t('data_sync.no_limit', '不限制数量')
                          : t('data_sync.count_unit_value', '$count 个').replace(
                              '$count',
                              val.toString()
                            )}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className={styles.countModalFooter}
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 8,
                    marginTop: 12
                  }}
                >
                  <button
                    className={`${styles.actionBtn} ${styles.btnOutlined}`}
                    onClick={() => setShowCountModal(false)}
                  >
                    {t('common.cancel', '取消')}
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.btnFilled}`}
                    onClick={() => {
                      const targetField =
                        activeTab === 'snapshot' ? 'maxSnapshotCount' : 'maxBackupCount'
                      updateField(targetField, tempCount)
                      onSaveConfig?.({ ...config, [targetField]: tempCount })
                      setShowCountModal(false)
                    }}
                  >
                    {t('common.confirm', '确定')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
