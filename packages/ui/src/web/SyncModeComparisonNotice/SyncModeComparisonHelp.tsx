import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MdHelpOutline } from 'react-icons/md'
import { Modal } from '../Modal/Modal'
import { mergeSettingsHelpButtonHandlers } from '../shared/settingsInlineHelpBlock'
import styles from './SyncModeComparisonHelp.module.css'

export type SyncModeComparisonHelpProps = {
  /** 高亮当前页面对应的同步方式 */
  context?: 'incremental' | 'fullBackup'
  size?: number
  className?: string
}

function SyncModeComparisonBody({ context }: { context?: 'incremental' | 'fullBackup' }) {
  const { t } = useTranslation()

  return (
    <div className={styles.body}>
      <div className={styles.grid}>
        <div className={styles.card} data-active={context === 'incremental'}>
          <div className={styles.cardTitle}>
            {t('data_sync.sync_mode_comparison_row_incremental')}
          </div>
          <p className={styles.cardDesc}>{t('data_sync.sync_mode_comparison_incremental_desc')}</p>
        </div>
        <div className={styles.card} data-active={context === 'fullBackup'}>
          <div className={styles.cardTitle}>{t('data_sync.sync_mode_comparison_row_full')}</div>
          <p className={styles.cardDesc}>{t('data_sync.sync_mode_comparison_full_desc')}</p>
        </div>
      </div>
      <p className={styles.hint}>{t('data_sync.sync_mode_comparison_hint')}</p>
    </div>
  )
}

/** 点击 ? 展开「增量同步 vs 全量备份」说明 */
export const SyncModeComparisonHelp: React.FC<SyncModeComparisonHelpProps> = ({
  context,
  size = 16,
  className = ''
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={`${styles.helpBtn} ${className}`.trim()}
        aria-label={t('data_sync.sync_mode_comparison_help_aria', '增量同步与全量备份的区别')}
        {...mergeSettingsHelpButtonHandlers(() => setOpen(true))}
      >
        <MdHelpOutline size={size} className={styles.helpIcon} aria-hidden />
      </button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t('data_sync.sync_mode_comparison_title')}
        closeOnOverlayClick
        className={styles.modal}
        zIndex={10050}
      >
        <SyncModeComparisonBody context={context} />
      </Modal>
    </>
  )
}

/** @deprecated 使用 SyncModeComparisonHelp，挂在范围标题旁 */
export const SyncModeComparisonNotice: React.FC<{
  context: 'incremental' | 'fullBackup'
}> = ({ context }) => <SyncModeComparisonHelp context={context} />
