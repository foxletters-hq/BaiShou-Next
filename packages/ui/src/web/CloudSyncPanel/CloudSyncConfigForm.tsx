import React from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Cloud, Folder, Globe, Home } from 'lucide-react'
import styles from './CloudSyncPanel.module.css'
import { inputStyle, labelStyle } from './cloud-sync.styles'
import type { CloudSyncPanelViewModel } from './useCloudSyncPanel'
import type { SyncConfig } from './cloud-sync.types'
import { CloudSyncPasswordField } from './CloudSyncPasswordField'

export interface CloudSyncConfigFormProps {
  vm: CloudSyncPanelViewModel
}

export const CloudSyncConfigForm: React.FC<CloudSyncConfigFormProps> = ({ vm }) => {
  const { t, config, showPassword, setShowPassword, setShowConfig, updateField, handleSaveConfig } =
    vm

  const sectionTitle =
    config.target === 'local'
      ? t('data_sync.s3_config_title', '本地存储配置').replace(
          'S3',
          t('data_sync.local_storage', '本地存储')
        )
      : config.target === 's3'
        ? t('data_sync.s3_config_title', 'S3 存储配置')
        : t('data_sync.webdav_config_title', 'WebDAV 存储配置')

  const renderTargetCard = (
    target: SyncConfig['target'],
    icon: React.ReactNode,
    title: string,
    desc: string
  ) => (
    <div
      className={`${styles.targetCardBig} ${config.target === target ? styles.targetCardSelected : ''}`}
      onClick={() => updateField('target', target)}
    >
      <div className={styles.targetCardIcon}>{icon}</div>
      <div className={styles.targetCardContent}>
        <div className={styles.targetCardTitle}>{title}</div>
        <div className={styles.targetCardDesc}>{desc}</div>
      </div>
    </div>
  )

  return (
    <motion.div
      key="config"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={styles.container}
      style={{ padding: 0 }}
    >
      <div className={styles.configPageWrapper}>
        <div className={styles.configAppBar}>
          <button
            type="button"
            className={styles.configBackButton}
            onClick={() => setShowConfig(false)}
          >
            <ArrowLeft size={24} />
          </button>
          <div className={styles.configAppTitle}>{t('data_sync.config_title', '数据备份配置')}</div>
          <div style={{ width: 40 }} />
        </div>

        <div className={styles.configContent}>
          <div className={styles.targetSectionTitle}>
            {t('data_sync.select_target_title', '选择备份目标')}
          </div>
          <div className={styles.targetCardsLayout}>
            {renderTargetCard(
              'local',
              <Folder size={24} />,
              t('data_sync.target_local', '本地存储'),
              t('data_sync.local_storage_desc', '直接将备份转储保存在应用所运行设备的本地磁盘中。')
            )}
            {renderTargetCard(
              's3',
              <Cloud size={24} />,
              t('data_sync.target_s3', 'S3 兼容存储'),
              t('data_sync.s3_storage_desc', '兼容 S3 协议的对象存储服务')
            )}
            {renderTargetCard(
              'webdav',
              <Globe size={24} />,
              t('data_sync.target_webdav', 'WebDAV'),
              t('data_sync.webdav_storage_desc', '通用网络文件存储协议')
            )}
          </div>

          <div className={styles.configSection}>
            <div className={styles.configSectionHeader}>
              <div className={styles.configSectionTitle}>{sectionTitle}</div>
            </div>
            <div className={styles.formDivider} />

            {config.target === 'local' && (
              <div className={styles.emptyLocalState}>
                <div style={{ marginBottom: 12, color: 'var(--color-on-surface-variant)' }}>
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
                  <CloudSyncPasswordField
                    label={t('data_sync.webdav_password_label', 'Password 密码')}
                    value={config.webdavPassword}
                    showPassword={showPassword}
                    onTogglePassword={() => setShowPassword(!showPassword)}
                    onChange={(v) => updateField('webdavPassword', v)}
                  />
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
                  <label style={labelStyle}>{t('data_sync.s3_path_label', 'Path 子路径')}</label>
                  <input
                    style={inputStyle}
                    value={config.s3Path}
                    onChange={(e) => updateField('s3Path', e.target.value)}
                  />
                </div>
                <div className={styles.formField}>
                  <CloudSyncPasswordField
                    label={t('data_sync.s3_ak_label', 'Access Key (AK)')}
                    value={config.s3AccessKey}
                    showPassword={showPassword}
                    onTogglePassword={() => setShowPassword(!showPassword)}
                    onChange={(v) => updateField('s3AccessKey', v)}
                  />
                </div>
                <div className={styles.formField}>
                  <CloudSyncPasswordField
                    label={t('data_sync.s3_sk_label', 'Secret Key (SK)')}
                    value={config.s3SecretKey}
                    showPassword={showPassword}
                    onTogglePassword={() => setShowPassword(!showPassword)}
                    onChange={(v) => updateField('s3SecretKey', v)}
                  />
                </div>
              </div>
            )}

            <div className={styles.configSectionFooter}>
              <button
                type="button"
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
  )
}
