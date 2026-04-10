import React, { useState, useEffect, useCallback } from 'react';
import styles from './CloudSyncPanel.module.css';
import { useTranslation } from 'react-i18next';
import { useToast } from '../Toast/useToast';
import { useDialog } from '../Dialog';
import { 
  Cloud, Globe, Folder, Database, History, RefreshCw, Trash2,
  CheckSquare, Settings, Archive, CloudUpload, ArrowLeft, Save, 
  Home, Package, DownloadCloud, Edit3, Loader2,
  Component, Map, Key, Eye, EyeOff, LayoutTemplate
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type SyncTarget = 'local' | 's3' | 'webdav';

export interface SyncConfig {
  target: SyncTarget;
  maxBackupCount: number;
  webdavUrl: string;
  webdavUsername: string;
  webdavPassword: string;
  webdavPath: string;
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3Path: string;
  s3AccessKey: string;
  s3SecretKey: string;
}

export interface SyncRecord {
  filename: string;
  lastModified: string;
  sizeInBytes: number;
}

export interface CloudSyncPanelProps {
  onSyncNow: (config: SyncConfig) => Promise<{ success: boolean; message: string }>;
  onListRecords: (config: SyncConfig) => Promise<SyncRecord[]>;
  onRestore: (config: SyncConfig, filename: string) => Promise<{ success: boolean; message: string }>;
  onDeleteRecord: (config: SyncConfig, filename: string) => Promise<boolean>;
  onBatchDelete: (config: SyncConfig, filenames: string[]) => Promise<number>;
  onRename: (config: SyncConfig, oldName: string, newName: string) => Promise<boolean>;
  savedConfig?: SyncConfig;
  onSaveConfig?: (config: SyncConfig) => void;
}

const DEFAULT_CONFIG: SyncConfig = {
  target: 'local',
  maxBackupCount: 20,
  webdavUrl: 'https://',
  webdavUsername: '',
  webdavPassword: '',
  webdavPath: '/baishou_backup',
  s3Endpoint: 'https://',
  s3Region: '',
  s3Bucket: '',
  s3Path: '/baishou_backup',
  s3AccessKey: '',
  s3SecretKey: '',
};

export const CloudSyncPanel: React.FC<CloudSyncPanelProps> = ({
  onSyncNow,
  onListRecords,
  onRestore,
  onDeleteRecord,
  onBatchDelete,
  onRename,
  savedConfig,
  onSaveConfig
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const dialog = useDialog();
  const [config, setConfig] = useState<SyncConfig>({ ...DEFAULT_CONFIG, ...(savedConfig || {}) });
  const [records, setRecords] = useState<SyncRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manageMode, setManageMode] = useState(false);
  const [showCountModal, setShowCountModal] = useState(false);
  const [tempCount, setTempCount] = useState(config.maxBackupCount);

  // Keep config in sync if savedConfig is loaded asynchronously or updated externally
  useEffect(() => {
    if (savedConfig) {
      setConfig((prev) => ({ ...DEFAULT_CONFIG, ...savedConfig }));
    }
  }, [savedConfig]);

  const fetchRecords = useCallback(async () => {
    if (config.target === 'local') { setRecords([]); return; }
    setIsLoading(true);
    try {
      const r = await onListRecords(config);
      setRecords(r);
    } catch (e: any) {
      toast.showError('获取备份列表失败: ' + (e.message || e));
    } finally {
      setIsLoading(false);
      setManageMode(false);
      setSelected(new Set());
    }
  }, [config, onListRecords, toast]);

  const handleSaveConfig = () => {
    onSaveConfig?.(config);
    setShowConfig(false);
    fetchRecords();
  };

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = async () => {
    if (config.target === 'local') { toast.show('当前同步目标为本地，请先配置云端'); return; }
    setIsSyncing(true);
    try {
      const res = await onSyncNow(config);
      if (res.success) toast.showSuccess(res.message); else toast.showError(res.message);
      if (res.success) await fetchRecords();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestore = async (filename: string) => {
    const confirmed = await dialog.confirm(
      t('sync.restore_confirm_msg', `确定要恢复备份 ${filename} 吗？\n当前本地数据将被覆盖。`)
    );
    if (!confirmed) return;
    setIsSyncing(true);
    try {
      const res = await onRestore(config, filename);
      if (res.success) toast.showSuccess(res.message); else toast.showError(res.message);
      if (res.success) {
        setTimeout(() => window.location.reload(), 1500);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async (filename: string) => {
    const confirmed = await dialog.confirm(t('sync.delete_confirm', `真的要删除云端备份 "${filename}" 吗？`));
    if (!confirmed) return;
    try {
      await onDeleteRecord(config, filename);
      await fetchRecords();
      toast.showSuccess('删除成功');
    } catch (e: any) {
      toast.showError('删除失败: ' + e.message);
    }
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    const confirmed = await dialog.confirm(t('sync.bulk_delete_confirm', `是否彻底删除选定的 ${selected.size} 个备份档案？此操作不可逆。`));
    if (!confirmed) return;
    try {
      await onBatchDelete(config, Array.from(selected));
      await fetchRecords();
      toast.showSuccess('批量删除成功');
    } catch (e: any) {
      toast.showError('批量删除失败: ' + e.message);
    }
  };

  const handleRename = async (oldName: string) => {
    const newName = await dialog.prompt('重命名', oldName);
    if (!newName || newName === oldName) return;
    try {
      await onRename(config, oldName, newName);
      await fetchRecords();
      toast.showSuccess('重命名成功');
    } catch (e: any) {
      toast.showError('重命名失败: ' + e.message);
    }
  };

  const totalSizeMb = records.reduce((sum, r) => sum + r.sizeInBytes, 0) / (1024 * 1024);
  const sizeString = totalSizeMb > 0 ? totalSizeMb.toFixed(2) + ' MB' : '0 MB';

  const updateField = (key: keyof SyncConfig, value: any) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    onSaveConfig?.(next); // Auto-save to prevent data loss on tab switch
  };

  const getTargetIcon = (target: string) => {
    if (target === 's3') return <Cloud size={24} strokeWidth={1.5} />;
    if (target === 'webdav') return <Globe size={24} strokeWidth={1.5} />;
    return <Folder size={24} strokeWidth={1.5} />;
  };

  const getTargetColor = (target: string) => {
    if (target === 's3') return '#0ea5e9'; // blue
    if (target === 'webdav') return '#8b5cf6'; // purple
    return '#64748b'; // slate
  };

  const [showPassword, setShowPassword] = useState(false);

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
            <button className={styles.configBackButton} onClick={() => setShowConfig(false)}><ArrowLeft size={24} /></button>
            <div className={styles.configAppTitle}>{t('data_sync.config_title', '数据同步配置')}</div>
            <div style={{ width: 40 }} /> {/* spacer for centering */}
          </div>
          
          <div className={styles.configContent}>
            <div className={styles.targetSectionTitle}>选择同步目标</div>
            <div className={styles.targetCardsLayout}>
              <div 
                className={`${styles.targetCardBig} ${config.target === 'local' ? styles.targetCardSelected : ''}`}
                onClick={() => updateField('target', 'local')}
              >
                <div className={styles.targetCardIcon}><Folder size={24} /></div>
                <div className={styles.targetCardContent}>
                  <div className={styles.targetCardTitle}>{t('data_sync.target_local', '本地存储')}</div>
                  <div className={styles.targetCardDesc}>{t('data_sync.local_storage_desc', '直接将备份转储保存在应用所运行设备的本地磁盘中。')}</div>
                </div>
              </div>
              <div 
                className={`${styles.targetCardBig} ${config.target === 's3' ? styles.targetCardSelected : ''}`}
                onClick={() => updateField('target', 's3')}
              >
                <div className={styles.targetCardIcon}><Cloud size={24} /></div>
                <div className={styles.targetCardContent}>
                  <div className={styles.targetCardTitle}>{t('data_sync.target_s3', 'S3 兼容存储')}</div>
                  <div className={styles.targetCardDesc}>{t('data_sync.s3_storage_desc', '兼容 AWS S3 的云存储服务')}</div>
                </div>
              </div>
              <div 
                className={`${styles.targetCardBig} ${config.target === 'webdav' ? styles.targetCardSelected : ''}`}
                onClick={() => updateField('target', 'webdav')}
              >
                <div className={styles.targetCardIcon}><Globe size={24} /></div>
                <div className={styles.targetCardContent}>
                  <div className={styles.targetCardTitle}>{t('data_sync.target_webdav', 'WebDAV')}</div>
                  <div className={styles.targetCardDesc}>{t('data_sync.webdav_storage_desc', '通用网络文件存储协议')}</div>
                </div>
              </div>
            </div>

            <div className={styles.configSection}>
              <div className={styles.configSectionHeader}>
                <div className={styles.configSectionTitle}>
                  {config.target === 'local' ? '本地存储配置' : 
                   config.target === 's3' ? 'S3 存储配置' : 'WebDAV 存储配置'}
                </div>
              </div>
              <div className={styles.formDivider} />

              {config.target === 'local' && (
                <div className={styles.emptyLocalState}>
                  <div style={{ marginBottom: 12, color: 'var(--color-on-surface-variant)' }}>
                     <Home size={64} strokeWidth={1} style={{ opacity: 0.5 }} />
                  </div>
                  <div>当前模式下产生的数据仅会存放于本地应用目录中，无需输入远程凭据。</div>
                </div>
              )}

              {config.target === 'webdav' && (
                <div className={styles.configGrid}>
                  <div className={styles.formField}>
                    <label>WebDAV URL 地址</label>
                    <div className={styles.inputPill}>
                      <Globe size={18} className={styles.pillIcon} />
                      <input value={config.webdavUrl} onChange={(e) => updateField('webdavUrl', e.target.value)} />
                    </div>
                  </div>
                  <div className={styles.formField}>
                    <label>Base Path 子路径</label>
                    <div className={styles.inputPill}>
                      <Folder size={18} className={styles.pillIcon} />
                      <input value={config.webdavPath} onChange={(e) => updateField('webdavPath', e.target.value)} />
                    </div>
                  </div>
                  <div className={styles.formField}>
                    <label>Username 用户名</label>
                    <div className={styles.inputPill}>
                      <Component size={18} className={styles.pillIcon} />
                      <input value={config.webdavUsername} onChange={(e) => updateField('webdavUsername', e.target.value)} />
                    </div>
                  </div>
                  <div className={styles.formField}>
                    <label>Password 密码</label>
                    <div className={styles.inputPill}>
                      <Key size={18} className={styles.pillIcon} />
                      <input type={showPassword ? "text" : "password"} value={config.webdavPassword} onChange={(e) => updateField('webdavPassword', e.target.value)} />
                      <button className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {config.target === 's3' && (
                <div className={styles.configGrid}>
                  <div className={styles.formField}>
                    <label>Endpoint 服务地址</label>
                    <div className={styles.inputPill}>
                      <Component size={18} className={styles.pillIcon} />
                      <input value={config.s3Endpoint} onChange={(e) => updateField('s3Endpoint', e.target.value)} />
                    </div>
                  </div>
                  <div className={styles.formField}>
                    <label>Region 区域名</label>
                    <div className={styles.inputPill}>
                      <Map size={18} className={styles.pillIcon} />
                      <input value={config.s3Region} onChange={(e) => updateField('s3Region', e.target.value)} />
                    </div>
                  </div>
                  <div className={styles.formField}>
                    <label>Bucket 存储桶</label>
                    <div className={styles.inputPill}>
                      <Database size={18} className={styles.pillIcon} />
                      <input value={config.s3Bucket} onChange={(e) => updateField('s3Bucket', e.target.value)} />
                    </div>
                  </div>
                  <div className={styles.formField}>
                    <label>Path 子路径</label>
                    <div className={styles.inputPill}>
                      <Folder size={18} className={styles.pillIcon} />
                      <input value={config.s3Path} onChange={(e) => updateField('s3Path', e.target.value)} />
                    </div>
                  </div>
                  <div className={styles.formField}>
                    <label>Access Key (AK)</label>
                    <div className={styles.inputPill}>
                      <Key size={18} className={styles.pillIcon} />
                      <input type={showPassword ? "text" : "password"} value={config.s3AccessKey} onChange={(e) => updateField('s3AccessKey', e.target.value)} />
                      <button className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div className={styles.formField}>
                    <label>Secret Key (SK)</label>
                    <div className={styles.inputPill}>
                      <Key size={18} className={styles.pillIcon} />
                      <input type={showPassword ? "text" : "password"} value={config.s3SecretKey} onChange={(e) => updateField('s3SecretKey', e.target.value)} />
                      <button className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.configSectionFooter}>
                <button className={`${styles.actionBtn} ${styles.btnSave}`} onClick={handleSaveConfig}>
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
          <div className={styles.statIconWrapper} style={{ backgroundColor: `${getTargetColor(config.target)}15`, color: getTargetColor(config.target) }}>
            {getTargetIcon(config.target)}
          </div>
          <div className={styles.statInfo}>
             <div className={styles.statLabel}>{t('data_sync.sync_target', '同步目标 (Target)')}</div>
             <div className={styles.statValue}>{config.target.toUpperCase()}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconWrapper} style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <Database size={24} strokeWidth={1.5} />
          </div>
          <div className={styles.statInfo}>
             <div className={styles.statLabel}>{t('data_sync.total_backup_size', '总备份大小')}</div>
             <div className={styles.statValue}>{sizeString}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconWrapper} style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
            <History size={24} strokeWidth={1.5} />
          </div>
          <div className={styles.statInfo}>
             <div className={styles.statLabel}>{t('data_sync.backup_count', '备份数量')}</div>
             <div className={styles.statValue}>{records.length} <span style={{fontSize: 14, fontWeight:'normal'}}>{t('common.copies_unit', '份')}</span></div>
          </div>
        </div>
      </div>

      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <div className={styles.titleBlock}>
            <span className={styles.titleLabel}>{t('data_sync.sync_records', '同步记录')}</span>
            <span className={styles.targetBadge}>{config.target.toUpperCase()}</span>
            <button className={styles.refreshBtn} onClick={fetchRecords} disabled={isLoading} title={t('common.refresh', '刷新')}>
               <RefreshCw size={18} />
            </button>
          </div>
          <span className={styles.subtitle}>{t('data_sync.records_scope_hint', '所选节点范围内的全部记录档案。')}</span>
        </div>

        <div className={styles.actionsGroup}>
          {manageMode ? (
            <>
              <button className={`${styles.actionBtn} ${styles.textBtn}`} onClick={() => { setManageMode(false); setSelected(new Set()); }}>
                {t('common.cancel', '取消')}
              </button>
              <button className={`${styles.actionBtn} ${styles.btnDangerFilled}`} onClick={handleBatchDelete} disabled={selected.size === 0}>
                <Trash2 size={16} /> {t('common.delete', '删除')} ({selected.size})
              </button>
            </>
          ) : (
             <button className={`${styles.actionBtn} ${styles.btnOutlined}`} onClick={() => setManageMode(true)} disabled={records.length === 0 || isLoading}>
               <CheckSquare size={16} /> 批量管理
             </button>
          )}

          <button className={`${styles.actionBtn} ${styles.btnOutlined}`} onClick={() => {
            setConfig({ ...DEFAULT_CONFIG, ...(savedConfig || {}) });
            setShowConfig(true);
          }}>
            <Settings size={16} /> {t('data_sync.sync_settings_button', '同步设置')}
          </button>
          
          <button className={`${styles.actionBtn} ${styles.btnOutlined}`} onClick={() => {
            setTempCount(config.maxBackupCount === -1 ? 20 : config.maxBackupCount);
            setShowCountModal(true);
          }}>
            <Archive size={16} /> {config.maxBackupCount === -1 ? t('data_sync.no_limit', '不限制数量') : t('data_sync.max_backup_count_value', '保留: $count').replace('$count', config.maxBackupCount.toString())}
          </button>

          <button className={`${styles.actionBtn} ${styles.btnFilled}`} onClick={handleSync} disabled={isSyncing || config.target === 'local'}>
             {isSyncing ? <><Loader2 size={16} style={{animation: 'spin 1.5s linear infinite'}} /> {t('data_sync.syncing_status', '同步中...')}</> : <><CloudUpload size={16} /> {t('data_sync.sync_now_button', '立即同步')}</>}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loadingState}>加载中...</div>
      ) : records.length === 0 ? (
        <div className={styles.emptyState}>{t('data_sync.no_records_hint', '暂无同步记录')}</div>
      ) : (
        <div className={styles.recordList}>
          {records.map((r) => (
            <div key={r.filename} className={`${styles.recordItem} ${selected.has(r.filename) ? styles.itemSelected : ''}`}>
              {manageMode && (
                <input type="checkbox" className={styles.customCheck} checked={selected.has(r.filename)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    e.target.checked ? next.add(r.filename) : next.delete(r.filename);
                    setSelected(next);
                  }} />
              )}
              <div className={styles.recordIcon}><Archive size={24} strokeWidth={1.5} /></div>
              <div className={styles.recordInfo}>
                <div className={styles.recordName}>{r.filename}</div>
                <div className={styles.recordMeta}>
                  {new Date(r.lastModified).toLocaleString()} · {(r.sizeInBytes / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
              {!manageMode && (
                <div className={styles.recordActions}>
                  <button className={`${styles.iconBtn} ${styles.iconBtnRestore}`} onClick={() => handleRestore(r.filename)} title="恢复此备份"><DownloadCloud size={16} /></button>
                  <button className={styles.iconBtn} onClick={() => handleRename(r.filename)} title="重命名"><Edit3 size={16} /></button>
                  <button className={`${styles.iconBtn} ${styles.iconBtnDelete}`} onClick={() => handleDelete(r.filename)} title="删除"><Trash2 size={16} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCountModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCountModal(false)}>
          <div className={styles.countModal} onClick={e => e.stopPropagation()}>
            <div className={styles.countModalHeader}>
              <Archive size={20} color="var(--color-primary, #0ea5e9)" />
              <div style={{fontWeight: 'bold'}}>设置最大备份数</div>
            </div>
            <div className={styles.countModalBody}>
              <div style={{fontSize: 13, color: 'var(--color-on-surface-variant)', marginBottom: 16}}>超出的旧备份将在同步后自动清理。</div>
              <div className={styles.sliderRow}>
                <input 
                  type="range" 
                  min="1" 
                  max="50" 
                  value={tempCount === -1 ? 50 : tempCount}
                  disabled={tempCount === -1}
                  onChange={(e) => setTempCount(parseInt(e.target.value))} 
                  className={styles.rangeSlider}
                />
                <span className={styles.countValueText}>{tempCount === -1 ? '∞' : tempCount}</span>
              </div>
            </div>
            <div className={styles.countModalFooter}>
              <button 
                className={styles.noLimitBtn} 
                onClick={() => {
                  updateField('maxBackupCount', -1);
                  onSaveConfig?.({ ...config, maxBackupCount: -1 });
                  setShowCountModal(false);
                }}
              >
                不限制上限
              </button>
              <div style={{display: 'flex', gap: 8}}>
                <button className={`${styles.actionBtn} ${styles.btnOutlined}`} onClick={() => setShowCountModal(false)}>取消</button>
                <button 
                  className={`${styles.actionBtn} ${styles.btnFilled}`} 
                  onClick={() => {
                    updateField('maxBackupCount', tempCount);
                    onSaveConfig?.({ ...config, maxBackupCount: tempCount });
                    setShowCountModal(false);
                  }}
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </motion.div>
      )}
    </AnimatePresence>
  );
};
