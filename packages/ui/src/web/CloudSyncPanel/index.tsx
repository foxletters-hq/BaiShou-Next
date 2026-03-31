import React, { useState, useEffect, useCallback } from 'react';
import styles from './CloudSyncPanel.module.css';

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
      `【高危操作】从云端恢复 "${filename}" 到本地将彻底覆盖当前的工作区数据。\n请输入 "CONFIRM" 确认：`
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
    if (!window.confirm(`确定要删除云端备份 "${filename}" 吗？此操作不可逆！`)) return;
    try {
      await onDeleteRecord(config, filename);
      await fetchRecords();
    } catch (e: any) {
      alert('删除失败: ' + e.message);
    }
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`确定要批量删除选中的 ${selected.size} 个备份吗？`)) return;
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
        <h3 className={styles.title}>数据云同步 (Cloud Sync)</h3>
        <p className={styles.subtitle}>
          将白守数据安全分发至 WebDAV 或 S3 兼容的云端，跨设备异步漫游。
        </p>
      </div>

      <div className={styles.statBar}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>☁️</div>
          <div className={styles.statText}>
            <span className={styles.statLabel}>分发终点 (Target)</span>
            <span className={styles.statValue}>{config.target.toUpperCase()}</span>
          </div>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statCard}>
          <div className={styles.statIcon}>💾</div>
          <div className={styles.statText}>
            <span className={styles.statLabel}>云端容载 (Size)</span>
            <span className={styles.statValue}>{totalSizeMb > 0 ? totalSizeMb.toFixed(2) + ' MB' : '0 MB'}</span>
          </div>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📦</div>
          <div className={styles.statText}>
             <span className={styles.statLabel}>母体存数 (Count)</span>
             <span className={styles.statValue}>{records.length} <small>份</small></span>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button className={styles.configBtn} onClick={() => setShowConfig(!showConfig)}>
            {showConfig ? '关闭设置' : '⚙ 同步设置'}
          </button>
          {!manageMode && records.length > 0 && (
            <button className={styles.manageBtn} onClick={() => setManageMode(true)}>批量管理</button>
          )}
          {manageMode && (
            <>
              <button className={styles.cancelBtn} onClick={() => { setManageMode(false); setSelected(new Set()); }}>取消选定</button>
              <button className={styles.deleteBtn} onClick={handleBatchDelete} disabled={selected.size === 0}>
                ☄️ 核爆选定档 ({selected.size})
              </button>
            </>
          )}
        </div>
        <button className={styles.syncBtn} onClick={handleSync} disabled={isSyncing || config.target === 'local'}>
          {isSyncing ? '同步中...' : '立即同步'}
        </button>
      </div>

      {/* Config Panel (collapsible) */}
      {showConfig && (
        <div className={styles.configPanel}>
          <div className={styles.configGroup}>
            <label>同步目标</label>
            <select value={config.target} onChange={(e) => updateField('target', e.target.value)}>
              <option value="local">本地 (关闭云同步)</option>
              <option value="webdav">WebDAV</option>
              <option value="s3">S3 (兼容)</option>
            </select>
          </div>

          <div className={styles.configGroup}>
            <label>最大备份份数</label>
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
                <label>用户名</label>
                <input value={config.webdavUsername} onChange={(e) => updateField('webdavUsername', e.target.value)} />
              </div>
              <div className={styles.configGroup}>
                <label>密码/授权码</label>
                <input type="password" value={config.webdavPassword} onChange={(e) => updateField('webdavPassword', e.target.value)} />
              </div>
              <div className={styles.configGroup}>
                <label>远端路径</label>
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
          <span>同步记录</span>
          <button className={styles.refreshBtn} onClick={fetchRecords} disabled={isLoading}>🔄</button>
        </div>

        {isLoading ? (
          <div className={styles.loadingState}>链接亚空间与握手中...</div>
        ) : records.length === 0 ? (
          <div className={styles.emptyState}>
            {config.target === 'local' ? '云同步引擎已处于离线沉睡状态。' : '此目标宇宙目前暂无发现您的数据遗迹。'}
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
                 <span className={styles.selectAllLabel}>全选所有 {records.length} 个锚点进行歼灭</span>
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
                    <button onClick={() => handleRestore(r.filename)} className={styles.restoreBtn} disabled={isSyncing}>恢复</button>
                    <button onClick={() => handleRename(r.filename)}>重命名</button>
                    <button onClick={() => handleDelete(r.filename)} className={styles.deleteSingleBtn}>删除</button>
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
