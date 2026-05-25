import React, { useState, useEffect } from 'react'
import {
  Save,
  TestTube,
  Cloud,
  Eye,
  EyeOff,
  Globe,
  Settings
} from 'lucide-react'
import { useSyncStore } from '@baishou/store'
import { useTranslation } from 'react-i18next'

type SyncTarget = 's3' | 'webdav'

export const SyncConfigForm: React.FC = () => {
  const { t } = useTranslation()
  const [target, setTarget] = useState<SyncTarget>('s3')
  const [endpoint, setEndpoint] = useState('')
  const [region, setRegion] = useState('')
  const [bucket, setBucket] = useState('')
  const [webdavUrl, setWebdavUrl] = useState('')

  // 隔离的特定凭据与前缀状态，防止 S3 与 WebDAV 相互污染
  const [s3AccessKey, setS3AccessKey] = useState('')
  const [s3SecretKey, setS3SecretKey] = useState('')
  const [s3Path, setS3Path] = useState('backup_sync')
  const [webdavUsername, setWebdavUsername] = useState('')
  const [webdavPassword, setWebdavPassword] = useState('')
  const [webdavPath, setWebdavPath] = useState('backup_sync')

  // 并行度配置
  const [chunkConcurrency, setChunkConcurrency] = useState(5)
  const [fileConcurrency, setFileConcurrency] = useState(5)

  const [showAccessKey, setShowAccessKey] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)
  
  const {
    status,
    message,
    setStatus,
    setMessage
  } = useSyncStore()

  useEffect(() => {
    loadConfig()
  }, [])

  const friendlyTestConnectionError = (msg: string): string => {
    if (!msg) return '连接失败'
    let cleanMsg = msg.replace(/^Error:\s*/i, '')
    cleanMsg = cleanMsg.replace(/^Error invoking remote method '.*?':\s*/i, '')

    if (cleanMsg.includes('not initialized')) {
      return '连接失败：同步服务未初始化，请输入配置'
    }
    if (
      cleanMsg.includes('401') ||
      cleanMsg.includes('Unauthorized') ||
      cleanMsg.includes('access key') ||
      cleanMsg.includes('signature') ||
      cleanMsg.includes('AccessDenied') ||
      cleanMsg.includes('InvalidAccessKeyId')
    ) {
      return '连接失败：凭据错误，请检查用户名/密码或 Access/Secret Key 是否正确'
    }
    if (cleanMsg.includes('ENOTFOUND') || cleanMsg.includes('getaddrinfo')) {
      return '连接失败：域名解析失败，请检查网络和 Endpoint/URL'
    }
    if (cleanMsg.includes('ECONNREFUSED')) {
      return '连接失败：连接被拒绝，请确认端点端口是否正确以及服务是否在线'
    }
    return `连接失败: ${cleanMsg}`
  }

  const loadConfig = async () => {
    try {
      const cfg = await (window as any).api?.incrementalSync?.getConfig()
      if (cfg) {
        const curTarget = cfg.target === 'webdav' ? 'webdav' : 's3'
        setTarget(curTarget)
        setEndpoint(cfg.endpoint || '')
        setRegion(cfg.region || '')
        setBucket(cfg.bucket || '')
        setWebdavUrl(cfg.webdavUrl || '')

        // 恢复 S3 的专属变量（兼容老版本未独立字段时降级使用主字段）
        const loadedS3AccessKey =
          cfg.s3AccessKey !== undefined ? cfg.s3AccessKey : curTarget === 's3' ? cfg.accessKey : ''
        const loadedS3SecretKey =
          cfg.s3SecretKey !== undefined ? cfg.s3SecretKey : curTarget === 's3' ? cfg.secretKey : ''
        const loadedS3Path =
          cfg.s3Path !== undefined ? cfg.s3Path : curTarget === 's3' ? cfg.path : 'backup_sync'
        setS3AccessKey(loadedS3AccessKey || '')
        setS3SecretKey(loadedS3SecretKey || '')
        setS3Path(loadedS3Path || 'backup_sync')

        // 恢复 WebDAV 的专属变量
        const loadedWebdavUsername =
          cfg.webdavUsername !== undefined
            ? cfg.webdavUsername
            : curTarget === 'webdav'
              ? cfg.accessKey
              : ''
        const loadedWebdavPassword =
          cfg.webdavPassword !== undefined
            ? cfg.webdavPassword
            : curTarget === 'webdav'
              ? cfg.secretKey
              : ''
        const loadedWebdavPath =
          cfg.webdavPath !== undefined
            ? cfg.webdavPath
            : curTarget === 'webdav'
              ? cfg.path
              : 'backup_sync'
        setWebdavUsername(loadedWebdavUsername || '')
        setWebdavPassword(loadedWebdavPassword || '')
        setWebdavPath(loadedWebdavPath || 'backup_sync')

        // 恢复并发度设置
        setChunkConcurrency(cfg.chunkConcurrency !== undefined ? cfg.chunkConcurrency : 5)
        setFileConcurrency(cfg.fileConcurrency !== undefined ? cfg.fileConcurrency : 5)
      }
    } catch {}
  }

  const handleSaveConfig = async () => {
    try {
      await (window as any).api?.incrementalSync?.updateConfig({
        enabled: true,
        target,
        endpoint,
        region,
        bucket,
        webdavUrl,
        // 后端核心消费字段根据 target 动态映射
        path: target === 'webdav' ? webdavPath : s3Path,
        accessKey: target === 'webdav' ? webdavUsername : s3AccessKey,
        secretKey: target === 'webdav' ? webdavPassword : s3SecretKey,
        // 保存两套各自隔离的字段以备下次无损恢复
        s3AccessKey,
        s3SecretKey,
        s3Path,
        webdavUsername,
        webdavPassword,
        webdavPath,
        // 并行度
        chunkConcurrency,
        fileConcurrency
      })
      setMessage('配置已保存')
      setStatus('success')
      setTimeout(() => {
        setStatus('idle')
        setMessage('')
      }, 2000)
    } catch (e: any) {
      setMessage(e?.message || '保存失败')
      setStatus('error')
    }
  }

  const handleTestConnection = async () => {
    setStatus('connecting')
    setMessage('正在测试连接...')
    try {
      const ok = await (window as any).api?.incrementalSync?.testConnection({
        target,
        endpoint,
        region,
        bucket,
        webdavUrl,
        path: target === 'webdav' ? webdavPath : s3Path,
        accessKey: target === 'webdav' ? webdavUsername : s3AccessKey,
        secretKey: target === 'webdav' ? webdavPassword : s3SecretKey,
        chunkConcurrency,
        fileConcurrency
      })
      setMessage(ok ? '连接成功' : '连接失败，请检查配置')
      setStatus(ok ? 'success' : 'error')
    } catch (e: any) {
      setMessage(friendlyTestConnectionError(e?.message || '连接失败'))
      setStatus('error')
    }
  }

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '20px'
      }}
    >
      <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600 }}>
        <Settings size={14} style={{ marginRight: 6 }} />
        配置
      </h3>

      {/* 目标选择 */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            display: 'block',
            marginBottom: 6
          }}
        >
          目标类型
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['s3', 'webdav'] as SyncTarget[]).map((t) => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: `1px solid ${target === t ? 'var(--color-primary)' : 'var(--border-muted)'}`,
                background: target === t ? 'rgba(91, 168, 245, 0.08)' : 'var(--bg-surface-low)',
                color: target === t ? 'var(--color-primary)' : 'var(--text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: target === t ? 600 : 400
              }}
            >
              {t === 's3' ? (
                <Cloud size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              ) : (
                <Globe size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              )}
              {t === 's3' ? 'S3' : 'WebDAV'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {target === 'webdav' ? (
          <div style={{ gridColumn: 'span 2' }}>
            <label
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: 4
              }}
            >
              WebDAV URL
            </label>
            <input
              type="text"
              value={webdavUrl}
              onChange={(e) => setWebdavUrl(e.target.value)}
              style={inputStyle}
            />
          </div>
        ) : (
          <>
            <div>
              <label style={labelStyle}>Endpoint</label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Bucket</label>
              <input
                type="text"
                value={bucket}
                onChange={(e) => setBucket(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Region</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                style={inputStyle}
              />
            </div>
          </>
        )}
        <div>
          <label style={labelStyle}>路径前缀</label>
          <input
            type="text"
            value={target === 'webdav' ? webdavPath : s3Path}
            onChange={(e) =>
              target === 'webdav' ? setWebdavPath(e.target.value) : setS3Path(e.target.value)
            }
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>{target === 'webdav' ? '用户名' : 'Access Key'}</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showAccessKey ? 'text' : 'password'}
              value={target === 'webdav' ? webdavUsername : s3AccessKey}
              onChange={(e) =>
                target === 'webdav'
                  ? setWebdavUsername(e.target.value)
                  : setS3AccessKey(e.target.value)
              }
              style={{ ...inputStyle, paddingRight: 36 }}
            />
            <button
              onClick={() => setShowAccessKey(!showAccessKey)}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                border: 'none',
                background: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                padding: 2
              }}
            >
              {showAccessKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label style={labelStyle}>{target === 'webdav' ? '密码' : 'Secret Key'}</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showSecretKey ? 'text' : 'password'}
              value={target === 'webdav' ? webdavPassword : s3SecretKey}
              onChange={(e) =>
                target === 'webdav'
                  ? setWebdavPassword(e.target.value)
                  : setS3SecretKey(e.target.value)
              }
              style={{ ...inputStyle, paddingRight: 36 }}
            />
            <button
              onClick={() => setShowSecretKey(!showSecretKey)}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                border: 'none',
                background: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                padding: 2
              }}
            >
              {showSecretKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label style={labelStyle}>文件并行度</label>
          <select
            value={fileConcurrency}
            onChange={(e) => setFileConcurrency(parseInt(e.target.value))}
            style={selectStyle}
          >
            {[1, 2, 3, 5, 10, 15, 20].map((v) => (
              <option key={v} value={v}>
                {v} 个文件并发
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>分块并行度（对象存储大文件）</label>
          <select
            value={chunkConcurrency}
            onChange={(e) => setChunkConcurrency(parseInt(e.target.value))}
            disabled={target !== 's3'}
            style={{ ...selectStyle, opacity: target !== 's3' ? 0.5 : 1 }}
          >
            {[5, 10, 15, 20].map((v) => (
              <option key={v} value={v}>
                {v} 个分块并发
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button
          onClick={handleSaveConfig}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            border: '1px solid var(--border-muted)',
            borderRadius: '6px',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          <Save size={14} /> 保存配置
        </button>
        <button
          onClick={handleTestConnection}
          disabled={status === 'connecting'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            border: '1px solid var(--border-muted)',
            borderRadius: '6px',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            cursor: 'pointer',
            opacity: status === 'connecting' ? 0.5 : 1
          }}
        >
          <TestTube size={14} /> 测试连接
        </button>
      </div>

      {message && (status === 'error' || status === 'success' || status === 'connecting') && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '13px',
            background:
              status === 'error'
                ? 'rgba(239, 68, 68, 0.1)'
                : status === 'success'
                  ? 'rgba(16, 185, 129, 0.1)'
                  : 'var(--bg-surface-low)',
            color:
              status === 'error'
                ? 'var(--color-error)'
                : status === 'success'
                  ? 'var(--color-success)'
                  : 'var(--text-secondary)',
            border: `1px solid ${status === 'error' ? 'var(--color-error)' : status === 'success' ? 'var(--color-success)' : 'var(--border-subtle)'}`
          }}
        >
          {message}
        </div>
      )}
    </div>
  )
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
const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border-muted)',
  borderRadius: '6px',
  background: 'var(--bg-surface-low)',
  color: 'var(--text-primary)',
  fontSize: '13px',
  boxSizing: 'border-box',
  outline: 'none'
}
