import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input, Select } from '@baishou/ui'
import { DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH } from '@baishou/shared'
import styles from './SyncForms.module.css'

interface WebDavSyncFormProps {
  config: any
  onChange: (cfg: Partial<any>) => void
}

/**
 * WebDAV 增量同步配置表单组件
 */
export const WebDavSyncForm: React.FC<WebDavSyncFormProps> = ({ config, onChange }) => {
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
      <div style={{ gridColumn: 'span 2' }}>
        <label className={styles.fieldLabel}>{t('data_sync.webdav_url', 'Server URL')}</label>
        <Input
          fieldSize="small"
          type="text"
          value={config.webdavUrl || ''}
          onChange={(e) => onChange({ webdavUrl: e.target.value })}
        />
      </div>
      <div>
        <label className={styles.fieldLabel}>{t('data_sync.path_prefix', 'Path Prefix')}</label>
        <Input
          fieldSize="small"
          type="text"
          value={config.webdavPath || DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH}
          onChange={(e) => onChange({ webdavPath: e.target.value })}
        />
      </div>
      <div>
        <label className={styles.fieldLabel}>{t('data_sync.webdav_user', 'Username')}</label>
        <Input
          fieldSize="small"
          type={showAccessKey ? 'text' : 'password'}
          value={config.webdavUsername || ''}
          onChange={(e) => onChange({ webdavUsername: e.target.value })}
          trailing={
            <button
              onClick={() => setShowAccessKey(!showAccessKey)}
              className={styles.eyeBtn}
              type="button"
            >
              {showAccessKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          }
        />
      </div>
      <div>
        <label className={styles.fieldLabel}>
          {t('data_sync.webdav_password', 'Password/App Token')}
        </label>
        <Input
          fieldSize="small"
          type={showSecretKey ? 'text' : 'password'}
          value={config.webdavPassword || ''}
          onChange={(e) => onChange({ webdavPassword: e.target.value })}
          trailing={
            <button
              onClick={() => setShowSecretKey(!showSecretKey)}
              className={styles.eyeBtn}
              type="button"
            >
              {showSecretKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          }
        />
      </div>
      <div>
        <label className={styles.fieldLabel}>
          {t('data_sync.file_concurrency', 'File Concurrency')}
        </label>
        <Select
          value={String(config.fileConcurrency || 5)}
          onChange={(e) => onChange({ fileConcurrency: parseInt(e.target.value) })}
          options={fileConcurrencyOptions}
          size="small"
        />
      </div>
      <div>
        <label className={styles.fieldLabel}>
          {t('data_sync.chunk_concurrency', 'Chunk Concurrency (large object storage)')}
        </label>
        <Select
          value={String(config.chunkConcurrency || 5)}
          disabled={true}
          options={chunkConcurrencyOptions}
          size="small"
        />
      </div>
    </div>
  )
}
