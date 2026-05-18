import React, { useState, useEffect } from 'react';
import { Save, TestTube, RefreshCw, Settings, Cloud, FileText, Eye, EyeOff, Globe } from 'lucide-react';

type SyncTarget = 's3' | 'webdav';

export const IncrementalSyncPage: React.FC = () => {
  const [target, setTarget] = useState<SyncTarget>('s3');
  const [endpoint, setEndpoint] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [bucket, setBucket] = useState('');
  const [pathPrefix, setPathPrefix] = useState('baishou/');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [webdavUrl, setWebdavUrl] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'syncing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [syncResult, setSyncResult] = useState<any>(null);

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      const cfg = await (window as any).api?.incrementalSync?.getConfig();
      if (cfg) {
        setTarget(cfg.target === 'webdav' ? 'webdav' : 's3');
        setEndpoint(cfg.endpoint || '');
        setRegion(cfg.region || 'us-east-1');
        setBucket(cfg.bucket || '');
        setPathPrefix(cfg.path || 'baishou/');
        setAccessKey(cfg.accessKey || '');
        setSecretKey(cfg.secretKey || '');
        setWebdavUrl(cfg.webdavUrl || '');
      }
    } catch {}
  };

  const handleSaveConfig = async () => {
    try {
      await (window as any).api?.incrementalSync?.updateConfig({
        enabled: true,
        target,
        endpoint,
        region,
        bucket,
        path: pathPrefix,
        accessKey,
        secretKey,
        webdavUrl,
      });
      setMessage('配置已保存');
      setStatus('success');
      setTimeout(() => { setStatus('idle'); setMessage(''); }, 2000);
    } catch (e: any) {
      setMessage(e?.message || '保存失败');
      setStatus('error');
    }
  };

  const handleTestConnection = async () => {
    setStatus('connecting');
    setMessage('正在测试连接...');
    try {
      const ok = await (window as any).api?.incrementalSync?.testConnection();
      setMessage(ok ? '连接成功' : '连接失败，请检查配置');
      setStatus(ok ? 'success' : 'error');
    } catch (e: any) {
      setMessage(e?.message || '连接失败');
      setStatus('error');
    }
  };

  const handleSync = async () => {
    setStatus('syncing');
    setMessage('正在同步...');
    setSyncResult(null);
    try {
      const result = await (window as any).api?.incrementalSync?.orchestratedSync();
      setSyncResult(result);
      setMessage('同步完成');
      setStatus('success');
    } catch (e: any) {
      setMessage(`同步失败: ${e?.message || '未知错误'}`);
      setStatus('error');
    }
  };

  const formatDuration = (ms: number) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

  return (
    <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600 }}>
        <FileText size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
        S3 / WebDAV 逐文件增量同步
      </h2>
      <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
        逐文件增量同步，支持删除传播。适合日常跨设备同步。全量备份请使用数据同步页面。
      </p>

      {/* 配置表单 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600 }}>
          <Settings size={14} style={{ marginRight: 6 }} />
          配置
        </h3>

        {/* 目标选择 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>目标类型</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['s3', 'webdav'] as SyncTarget[]).map((t) => (
              <button key={t} onClick={() => setTarget(t)}
                style={{
                  padding: '8px 16px', borderRadius: '6px', border: `1px solid ${target === t ? 'var(--color-primary)' : 'var(--border-muted)'}`,
                  background: target === t ? 'rgba(91, 168, 245, 0.08)' : 'var(--bg-surface-low)',
                  color: target === t ? 'var(--color-primary)' : 'var(--text-secondary)',
                  fontSize: '13px', cursor: 'pointer', fontWeight: target === t ? 600 : 400,
                }}
              >
                {t === 's3' ? <Cloud size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> : <Globe size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />}
                {t === 's3' ? 'S3' : 'WebDAV'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {target === 'webdav' ? (
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>WebDAV URL</label>
              <input type="text" value={webdavUrl} onChange={e => setWebdavUrl(e.target.value)}
                placeholder="https://dav.example.com/remote.php/dav/files/user/"
                style={inputStyle} />
            </div>
          ) : (
            <>
              <div>
                <label style={labelStyle}>Endpoint</label>
                <input type="text" value={endpoint} onChange={e => setEndpoint(e.target.value)}
                  placeholder="https://s3.amazonaws.com" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Bucket</label>
                <input type="text" value={bucket} onChange={e => setBucket(e.target.value)}
                  placeholder="my-bucket" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Region</label>
                <input type="text" value={region} onChange={e => setRegion(e.target.value)}
                  placeholder="us-east-1" style={inputStyle} />
              </div>
            </>
          )}
          <div>
            <label style={labelStyle}>路径前缀</label>
            <input type="text" value={pathPrefix} onChange={e => setPathPrefix(e.target.value)}
              placeholder="baishou/" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{target === 'webdav' ? '用户名' : 'Access Key'}</label>
            <input type="text" value={accessKey} onChange={e => setAccessKey(e.target.value)}
              placeholder={target === 'webdav' ? 'username' : 'AKIAIOSFODNN7EXAMPLE'} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{target === 'webdav' ? '密码' : 'Secret Key'}</label>
            <div style={{ position: 'relative' }}>
              <input type={showSecret ? 'text' : 'password'} value={secretKey} onChange={e => setSecretKey(e.target.value)}
                placeholder={target === 'webdav' ? 'password' : 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'}
                style={{ ...inputStyle, paddingRight: 36 }} />
              <button onClick={() => setShowSecret(!showSecret)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  border: 'none', background: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }}>
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button onClick={handleSaveConfig}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              border: '1px solid var(--border-muted)', borderRadius: '6px',
              background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}>
            <Save size={14} /> 保存配置
          </button>
          <button onClick={handleTestConnection} disabled={status === 'connecting'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              border: '1px solid var(--border-muted)', borderRadius: '6px',
              background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer',
              opacity: status === 'connecting' ? 0.5 : 1 }}>
            <TestTube size={14} /> 测试连接
          </button>
        </div>

        {message && (
          <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
            background: status === 'error' ? 'rgba(239, 68, 68, 0.1)' : status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-surface-low)',
            color: status === 'error' ? 'var(--color-error)' : status === 'success' ? 'var(--color-success)' : 'var(--text-secondary)',
            border: `1px solid ${status === 'error' ? 'var(--color-error)' : status === 'success' ? 'var(--color-success)' : 'var(--border-subtle)'}` }}>
            {message}
          </div>
        )}
      </div>

      {/* 同步操作 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px 24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600 }}>
          <Cloud size={14} style={{ marginRight: 6 }} />
          同步操作
        </h3>

        <button onClick={handleSync} disabled={status === 'syncing'}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
            border: '1px solid var(--color-primary)', borderRadius: '8px',
            background: status === 'syncing' ? 'var(--bg-surface)' : 'var(--color-primary)',
            color: status === 'syncing' ? 'var(--text-primary)' : 'var(--text-on-primary)',
            fontSize: '14px', fontWeight: 500, cursor: 'pointer', opacity: status === 'syncing' ? 0.6 : 1 }}>
          <RefreshCw size={16}
            style={status === 'syncing' ? { animation: 'spin 1s linear infinite' } : undefined} />
          {status === 'syncing' ? '同步中...' : '立即同步'}
        </button>

        {syncResult && (
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <StatCard label="上传" value={syncResult.uploaded?.length || 0} color="var(--color-primary)" />
            <StatCard label="下载" value={syncResult.downloaded?.length || 0} color="var(--color-success)" />
            <StatCard label="删除" value={(syncResult.deletedRemote?.length || 0) + (syncResult.deletedLocal?.length || 0)} color="var(--color-error)" />
            <StatCard label="冲突" value={syncResult.conflicted?.length || 0} color="var(--color-warning)" />
            <StatCard label="跳过" value={syncResult.skipped?.length || 0} color="var(--text-tertiary)" />
            <StatCard label="耗时" value={syncResult.duration ? formatDuration(syncResult.duration) : '-'} color="var(--text-secondary)" isText />
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const labelStyle: React.CSSProperties = { fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border-muted)', borderRadius: '6px', background: 'var(--bg-surface-low)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' };

const StatCard: React.FC<{ label: string; value: number | string; color: string; isText?: boolean }> = ({ label, value, color, isText }) => (
  <div style={{ background: 'var(--bg-surface-low)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: isText ? '13px' : '20px', fontWeight: 600, color }}>{value}</div>
  </div>
);
