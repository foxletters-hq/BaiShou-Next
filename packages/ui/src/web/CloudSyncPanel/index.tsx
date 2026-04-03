import React, { useState, useEffect, useCallback } from 'react';
import styles from './CloudSyncPanel.module.css';
import { useTranslation } from 'react-i18next';


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
  const [config, setConfig] = useState<SyncConfig>(savedConfig || DEFAULT_CONFIG);
  const [records, setRecords] = useState<SyncRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manageMode, setManageMode] = useState(false);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelected(new Set(records.map(r => r.filename)));
    } else {
      setSelected(new Set());
    }
  };

  const fetchRecords = useCallback(async () => {
    if (config.target === 'local') { setRecords([]); return; }
    setIsLoading(true);
    try {
      const r = await onListRecords(config);
      setRecords(r);
    } catch (e: any) {
      alert('获取备份列表失败: ' + (e.message || e));
    } finally {
      setIsLoading(false);
      setManageMode(false);
      setSelected(new Set());
    }
  }, [config, onListRecords]);

  useEffect(() => { fetchRecords(); }, [config.target]);

  const handleSync = async () => {
    if (config.target === 'local') { alert('当前同步目标为本地，请先配置云端'); return; }
    setIsSyncing(true);
    try {
      const res = await onSyncNow(config);
      alert(res.message);
      if (res.success) await fetchRecords();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestore = async (filename: string) => {
    const confirmText = window.prompt(
      t('sync.restore_confirm_msg', '【覆盖警告】从云端下拉 "{{filename}}" 将覆盖本地现存的所有数据设定。\n请输入 "CONFIRM" 提交确认意向：', { filename })
    );
    if (confirmText !== 'CONFIRM') return;
    setIsSyncing(true);
    try {
      const res = await onRestore(config, filename);
      alert(res.message);
      if (res.success) window.location.reload();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!window.confirm(t('sync.delete_confirm', '真的要删除云端备份 "{{filename}}" 吗？', { filename }))) return;
    try {
      await onDeleteRecord(config, filename);
      await fetchRecords();
    } catch (e: any) {
      alert('删除失败: ' + e.message);
    }
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(t('sync.bulk_delete_confirm', '是否彻底删除选定的 {{count}} 个备份档案？', { count: selected.size }))) return;
    try {
      await onBatchDelete(config, Array.from(selected));
      await fetchRecords();
    } catch (e: any) {
      alert('批量删除失败: ' + e.message);
    }
  };

  const handleRename = async (oldName: string) => {
    const newName = window.prompt('输入新的文件名：', oldName);
    if (!newName || newName === oldName) return;
    try {
      await onRename(config, oldName, newName);
      await fetchRecords();
    } catch (e: any) {
      alert('重命名失败: ' + e.message);
    }
  };

  const totalSizeMb = records.reduce((sum, r) => sum + r.sizeInBytes, 0) / (1024 * 1024);
  const updateField = (key: keyof SyncConfig, value: any) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    onSaveConfig?.(next);
  };

  return (
    <div className={styles.container}>
      {/* Header Stats */}
      <div className={styles.header}>
        <h3 className={styles.title}>{t('sync.title', '数据云端同步 (Cloud Config)')}</h3>
        <p className={styles.subtitle}>
          {t('sync.subtitle', '建立连接同步本地的所有状态到您具有私属权限的 WebDAV / S3 对象存储空间。')}
        </p>
      </div>

      <div className={styles.statBar}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>☁️</div>
          <div className={styles.statText}>
            <span className={styles.statLabel}>{t('sync.target_label', '分发目标 (Target)')}</span>
            <span className={styles.statValue}>{config.target.toUpperCase()}</span>
          </div>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statCard}>
          <div className={styles.statIcon}>💾</div>
          <div className={styles.statText}>
            <span className={styles.statLabel}>{t('sync.size_label', '占用容量 (Size)')}</span>
            <span className={styles.statValue}>{totalSizeMb > 0 ? totalSizeMb.toFixed(2) + ' MB' : '0 MB'}</span>
          </div>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📦</div>
          <div className={styles.statText}>
             <span className={styles.statLabel}>{t('sync.count_label', '快照分布数 (Count)')}</span>
             <span className={styles.statValue}>{records.length} <small>{t('common.copies_unit', '份')}</small></span>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button className={styles.configBtn} onClick={() => setShowConfig(!showConfig)}>
            {showConfig ? t('common.close_settings', '关闭设置板块') : t('sync.open_settings', '⚙ 配置连接')}
          </button>
          {!manageMode && records.length > 0 && (
            <button className={styles.manageBtn} onClick={() => setManageMode(true)}>{t('common.batch_manage', '批量管理')}</button>
          )}
          {manageMode && (
            <>
              <button className={styles.cancelBtn} onClick={() => { setManageMode(false); setSelected(new Set()); }}>取消选定</button>
              <button className={styles.deleteBtn} onClick={handleBatchDelete} disabled={selected.size === 0}>
                {t('sync.delete_selected', '删除选中行')} ({selected.size})
              </button>
            </>
          )}
        </div>
        <button className={styles.syncBtn} onClick={handleSync} disabled={isSyncing || config.target === 'local'}>
          {isSyncing ? t('sync.syncing', '正在交接拉链...') : t('sync.sync_now', '触发立即同步')}
        </button>
      </div>

      {/* Config Panel (collapsible) */}
      {showConfig && (
        <div className={styles.configPanel}>
          <div className={styles.configGroup}>
            <label>{t('sync.target_type', '服务通道')}</label>
            <select value={config.target} onChange={(e) => updateField('target', e.target.value)}>
              <option value="local">{t('sync.local_only', '系统本地（切断云连接）')}</option>
              <option value="webdav">WebDAV</option>
              <option value="s3">{t('sync.s3_compatible', 'S3 (通用对象存储)')}</option>
            </select>
          </div>

          <div className={styles.configGroup}>
            <label>{t('sync.max_count', '最高留存上限数')}</label>
            <input type="number" min={1} max={100} value={config.maxBackupCount}
              onChange={(e) => updateField('maxBackupCount', parseInt(e.target.value) || 20)} />
          </div>

          {config.target === 'webdav' && (
            <>
              <div className={styles.configGroup}>
                <label>WebDAV URL</label>
                <input value={config.webdavUrl} onChange={(e) => updateField('webdavUrl', e.target.value)} placeholder="https://dav.jianguoyun.com/dav/" />
              </div>
              <div className={styles.configGroup}>
                <label>{t('common.username', '用户名身份')}</label>
                <input value={config.webdavUsername} onChange={(e) => updateField('webdavUsername', e.target.value)} />
              </div>
              <div className={styles.configGroup}>
                <label>{t('common.password', '授权秘钥/密码')}</label>
                <input type="password" value={config.webdavPassword} onChange={(e) => updateField('webdavPassword', e.target.value)} />
              </div>
              <div className={styles.configGroup}>
                <label>{t('sync.remote_path', '存放路径地址')}</label>
                <input value={config.webdavPath} onChange={(e) => updateField('webdavPath', e.target.value)} />
              </div>
            </>
          )}

          {config.target === 's3' && (
            <>
              <div className={styles.configGroup}>
                <label>Endpoint</label>
                <input value={config.s3Endpoint} onChange={(e) => updateField('s3Endpoint', e.target.value)} placeholder="https://cos.ap-shanghai.myqcloud.com" />
              </div>
              <div className={styles.configGroup}>
                <label>Region</label>
                <input value={config.s3Region} onChange={(e) => updateField('s3Region', e.target.value)} placeholder="ap-shanghai" />
              </div>
              <div className={styles.configGroup}>
                <label>Bucket</label>
                <input value={config.s3Bucket} onChange={(e) => updateField('s3Bucket', e.target.value)} />
              </div>
              <div className={styles.configGroup}>
                <label>Access Key</label>
                <input value={config.s3AccessKey} onChange={(e) => updateField('s3AccessKey', e.target.value)} />
              </div>
              <div className={styles.configGroup}>
                <label>Secret Key</label>
                <input type="password" value={config.s3SecretKey} onChange={(e) => updateField('s3SecretKey', e.target.value)} />
              </div>
              <div className={styles.configGroup}>
                <label>远端路径</label>
                <input value={config.s3Path} onChange={(e) => updateField('s3Path', e.target.value)} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Records List */}
      <div className={styles.recordsSection}>
        <div className={styles.recordsHeader}>
          <span>{t('sync.records', '近期远端发现记录')}</span>
          <button className={styles.refreshBtn} onClick={fetchRecords} disabled={isLoading}>🔄</button>
        </div>

        {isLoading ? (
          <div className={styles.loadingState}>{t('sync.connecting', '正在通过信道提取端列...')}</div>
        ) : records.length === 0 ? (
          <div className={styles.emptyState}>
            {config.target === 'local' ? t('sync.offline_desc', '主引擎已被物理降频，目前处于断开云端的休眠状态。') : t('sync.no_records', '尚未在对应的云空间发现归属备份条目。')}
          </div>
        ) : (
          <div className={styles.recordList}>
            {manageMode && (
               <div className={styles.selectAllHeader}>
                 <input 
                   type="checkbox" 
                   className={styles.customCheck}
                   checked={selected.size === records.length && records.length > 0} 
                   onChange={handleSelectAll} 
                 />
                 <span className={styles.selectAllLabel}>{t('common.select_all_items', '一键勾选视野内全量内容 ({{count}} 项)', { count: records.length })}</span>
               </div>
            )}
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
                <div className={styles.recordInfo}>
                  <div className={styles.recordName}>{r.filename}</div>
                  <div className={styles.recordMeta}>
                    {new Date(r.lastModified).toLocaleString()} · {(r.sizeInBytes / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                {!manageMode && (
                  <div className={styles.recordActions}>
                    <button onClick={() => handleRestore(r.filename)} className={styles.restoreBtn} disabled={isSyncing}>{t('common.restore', '追溯恢复')}</button>
                    <button onClick={() => handleRename(r.filename)}>{t('common.rename', '修改标注')}</button>
                    <button onClick={() => handleDelete(r.filename)} className={styles.deleteSingleBtn}>{t('common.delete', '废弃')}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
