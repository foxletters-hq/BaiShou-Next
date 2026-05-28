import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Select } from '@baishou/ui'

interface S3SyncFormProps {
  config: any
  onChange: (cfg: Partial<any>) => void
}

/**
 * S3 增量同步配置表单组件
 */
export const S3SyncForm: React.FC<S3SyncFormProps> = ({ config, onChange }) => {
  const { t } = useTranslation()
  const [showAccessKey, setShowAccessKey] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)

  const fileConcurrencyOptions = [1, 2, 3, 5, 10, 15, 20].map((v) => ({
    value: String(v),
    label: t('data_sync.file_concurrency_option', '{{count}} files in parallel', { count: v })
  }))

  const chunkConcurrencyOptions = [5, 10, 15, 20].map((v) => ({
    value: String(v),
    label: t('data_sync.chunk_concurrency_option', '{{count}} chunks in parallel', {
      count: v
    })
  }))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      <div>
        <label style={labelStyle}>{t('data_sync.s3_endpoint', 'Endpoint')}</label>
        <input
          type="text"
          value={config.endpoint || ''}
          onChange={(e) => onChange({ endpoint: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>{t('data_sync.s3_bucket', 'Bucket')}</label>
        <input
          type="text"
          value={config.bucket || ''}
          onChange={(e) => onChange({ bucket: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>{t('data_sync.s3_region', 'Region (Optional)')}</label>
        <input
          type="text"
          value={config.region || ''}
          onChange={(e) => onChange({ region: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>{t('data_sync.path_prefix', 'Path Prefix')}</label>
        <input
          type="text"
          value={config.s3Path || 'backup_sync'}
          onChange={(e) => onChange({ s3Path: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>{t('data_sync.s3_access_key', 'Access Key')}</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showAccessKey ? 'text' : 'password'}
            value={config.s3AccessKey || ''}
            onChange={(e) => onChange({ s3AccessKey: e.target.value })}
            style={{ ...inputStyle, paddingRight: 36 }}
          />
          <button
            onClick={() => setShowAccessKey(!showAccessKey)}
            style={eyeButtonStyle}
            type="button"
          >
            {showAccessKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
      <div>
        <label style={labelStyle}>{t('data_sync.s3_secret_key', 'Secret Key')}</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showSecretKey ? 'text' : 'password'}
            value={config.s3SecretKey || ''}
            onChange={(e) => onChange({ s3SecretKey: e.target.value })}
            style={{ ...inputStyle, paddingRight: 36 }}
          />
          <button
            onClick={() => setShowSecretKey(!showSecretKey)}
            style={eyeButtonStyle}
            type="button"
          >
            {showSecretKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
      <div>
        <label style={labelStyle}>{t('data_sync.file_concurrency', 'File Concurrency')}</label>
        <Select
          value={String(config.fileConcurrency || 5)}
          onChange={(e) => onChange({ fileConcurrency: parseInt(e.target.value) })}
          options={fileConcurrencyOptions}
          size="small"
        />
      </div>
      <div>
        <label style={labelStyle}>
          {t('data_sync.chunk_concurrency', 'Chunk Concurrency (large object storage)')}
        </label>
        <Select
          value={String(config.chunkConcurrency || 5)}
          onChange={(e) => onChange({ chunkConcurrency: parseInt(e.target.value) })}
          options={chunkConcurrencyOptions}
          size="small"
        />
      </div>
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
const eyeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  right: 8,
  top: '50%',
  transform: 'translateY(-50%)',
  border: 'none',
  background: 'none',
  color: 'var(--text-tertiary)',
  cursor: 'pointer',
  padding: 2
}
