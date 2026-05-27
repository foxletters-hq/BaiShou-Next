import React, { useState, useEffect } from 'react'
import { Save, TestTube, Cloud, Globe, Settings } from 'lucide-react'
import { useSyncStore } from '@baishou/store'
import { useTranslation } from 'react-i18next'
import { S3SyncForm } from './S3SyncForm'
import { WebDavSyncForm } from './WebDavSyncForm'

type SyncTarget = 's3' | 'webdav'

export const SyncConfigForm: React.FC = () => {
  const { t } = useTranslation()
  const { status, message, setStatus, setMessage } = useSyncStore()

  const [config, setConfig] = useState<any>({
    target: 's3',
    endpoint: '',
    region: '',
    bucket: '',
    s3AccessKey: '',
    s3SecretKey: '',
    s3Path: 'backup_sync',
    webdavUrl: '',
    webdavUsername: '',
    webdavPassword: '',
    webdavPath: 'backup_sync',
    fileConcurrency: 5,
    chunkConcurrency: 5
  })

  useEffect(() => {
    loadConfig()
  }, [])

  const friendlyTestConnectionError = (msg: string): string => {
    if (!msg) return t('data_sync.connection_failed', 'Connection failed')
    let cleanMsg = msg.replace(/^Error:\s*/i, '')
    cleanMsg = cleanMsg.replace(/^Error invoking remote method '.*?':\s*/i, '')

    if (cleanMsg.includes('not initialized')) {
      return t(
        'data_sync.error_test_not_initialized',
        'Connection failed: sync service is not initialized. Please enter configuration first.'
      )
    }
    if (
      cleanMsg.includes('401') ||
      cleanMsg.includes('Unauthorized') ||
      cleanMsg.includes('access key') ||
      cleanMsg.includes('signature') ||
      cleanMsg.includes('AccessDenied') ||
      cleanMsg.includes('InvalidAccessKeyId')
    ) {
      return t(
        'data_sync.error_test_credentials',
        'Connection failed: invalid credentials. Please check username/password or Access/Secret Key.'
      )
    }
    if (cleanMsg.includes('ENOTFOUND') || cleanMsg.includes('getaddrinfo')) {
      return t(
        'data_sync.error_test_dns',
        'Connection failed: hostname resolution failed. Please check network and endpoint/URL.'
      )
    }
    if (cleanMsg.includes('ECONNREFUSED')) {
      return t(
        'data_sync.error_test_conn_refused',
        'Connection failed: connection refused. Please verify port and service availability.'
      )
    }
    return t('data_sync.error_connection_failed_with_msg', 'Connection failed: {{msg}}', {
      msg: cleanMsg
    })
  }

  const loadConfig = async () => {
    try {
      const cfg = await (window as any).api?.incrementalSync?.getConfig()
      if (cfg) {
        const curTarget = cfg.target === 'webdav' ? 'webdav' : 's3'
        const loadedS3AccessKey =
          cfg.s3AccessKey !== undefined ? cfg.s3AccessKey : curTarget === 's3' ? cfg.accessKey : ''
        const loadedS3SecretKey =
          cfg.s3SecretKey !== undefined ? cfg.s3SecretKey : curTarget === 's3' ? cfg.secretKey : ''
        const loadedS3Path =
          cfg.s3Path !== undefined ? cfg.s3Path : curTarget === 's3' ? cfg.path : 'backup_sync'

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

        setConfig({
          target: curTarget,
          endpoint: cfg.endpoint || '',
          region: cfg.region || '',
          bucket: cfg.bucket || '',
          webdavUrl: cfg.webdavUrl || '',
          s3AccessKey: loadedS3AccessKey || '',
          s3SecretKey: loadedS3SecretKey || '',
          s3Path: loadedS3Path || 'backup_sync',
          webdavUsername: loadedWebdavUsername || '',
          webdavPassword: loadedWebdavPassword || '',
          webdavPath: loadedWebdavPath || 'backup_sync',
          chunkConcurrency: cfg.chunkConcurrency !== undefined ? cfg.chunkConcurrency : 5,
          fileConcurrency: cfg.fileConcurrency !== undefined ? cfg.fileConcurrency : 5
        })
      }
    } catch {}
  }

  const handleConfigChange = (updated: Partial<any>) => {
    setConfig((prev: any) => ({ ...prev, ...updated }))
  }

  const handleSaveConfig = async () => {
    try {
      await (window as any).api?.incrementalSync?.updateConfig({
        enabled: true,
        target: config.target,
        endpoint: config.endpoint,
        region: config.region,
        bucket: config.bucket,
        webdavUrl: config.webdavUrl,
        path: config.target === 'webdav' ? config.webdavPath : config.s3Path,
        accessKey: config.target === 'webdav' ? config.webdavUsername : config.s3AccessKey,
        secretKey: config.target === 'webdav' ? config.webdavPassword : config.s3SecretKey,
        s3AccessKey: config.s3AccessKey,
        s3SecretKey: config.s3SecretKey,
        s3Path: config.s3Path,
        webdavUsername: config.webdavUsername,
        webdavPassword: config.webdavPassword,
        webdavPath: config.webdavPath,
        chunkConcurrency: config.chunkConcurrency,
        fileConcurrency: config.fileConcurrency
      })
      setMessage(t('data_sync.config_saved', 'Configuration saved'))
      setStatus('success')
      setTimeout(() => {
        setStatus('idle')
        setMessage('')
      }, 2000)
    } catch (e: any) {
      setMessage(e?.message || t('data_sync.save_failed', 'Save failed'))
      setStatus('error')
    }
  }

  const handleTestConnection = async () => {
    setStatus('connecting')
    setMessage(t('data_sync.testing_connection', 'Testing connection...'))
    try {
      const ok = await (window as any).api?.incrementalSync?.testConnection({
        target: config.target,
        endpoint: config.endpoint,
        region: config.region,
        bucket: config.bucket,
        webdavUrl: config.webdavUrl,
        path: config.target === 'webdav' ? config.webdavPath : config.s3Path,
        accessKey: config.target === 'webdav' ? config.webdavUsername : config.s3AccessKey,
        secretKey: config.target === 'webdav' ? config.webdavPassword : config.s3SecretKey,
        chunkConcurrency: config.chunkConcurrency,
        fileConcurrency: config.fileConcurrency
      })
      setMessage(
        ok
          ? t('data_sync.connection_success', 'Connection successful')
          : t(
              'data_sync.connection_failed_check',
              'Connection failed, please check your configuration'
            )
      )
      setStatus(ok ? 'success' : 'error')
    } catch (e: any) {
      setMessage(
        friendlyTestConnectionError(
          e?.message || t('data_sync.connection_failed', 'Connection failed')
        )
      )
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
        {t('data_sync.config_section', 'Configuration')}
      </h3>

      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            display: 'block',
            marginBottom: 6
          }}
        >
          {t('data_sync.target_type', 'Target Type')}
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['s3', 'webdav'] as SyncTarget[]).map((item) => (
            <button
              key={item}
              onClick={() => handleConfigChange({ target: item })}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: `1px solid ${config.target === item ? 'var(--color-primary)' : 'var(--border-muted)'}`,
                background:
                  config.target === item ? 'rgba(91, 168, 245, 0.08)' : 'var(--bg-surface-low)',
                color: config.target === item ? 'var(--color-primary)' : 'var(--text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: config.target === item ? 600 : 400
              }}
            >
              {item === 's3' ? (
                <Cloud size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              ) : (
                <Globe size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              )}
              {item === 's3' ? 'S3' : 'WebDAV'}
            </button>
          ))}
        </div>
      </div>

      {config.target === 'webdav' ? (
        <WebDavSyncForm config={config} onChange={handleConfigChange} />
      ) : (
        <S3SyncForm config={config} onChange={handleConfigChange} />
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button onClick={handleSaveConfig} style={actionButtonStyle}>
          <Save size={14} /> {t('data_sync.save_config', 'Save Config')}
        </button>
        <button
          onClick={handleTestConnection}
          disabled={status === 'connecting'}
          style={{ ...actionButtonStyle, opacity: status === 'connecting' ? 0.5 : 1 }}
        >
          <TestTube size={14} /> {t('data_sync.test_connection', 'Test Connection')}
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

const actionButtonStyle: React.CSSProperties = {
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
}
