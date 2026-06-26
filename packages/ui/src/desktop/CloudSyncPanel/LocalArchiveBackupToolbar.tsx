import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, HelpCircle, Loader2, Upload } from 'lucide-react'
import { useDialog } from '../Dialog'
import { useToast } from '../Toast/useToast'
import { Tooltip } from '../Tooltip/Tooltip'
import { RestoreBlockingOverlay } from '../RestoreBlockingOverlay'
import { formatExportErrorMessage } from '../archive-export.util'
import styles from './CloudSyncPanel.module.css'

export interface LocalArchiveBackupToolbarProps {
  onExportZip: () => Promise<string | null | undefined>
  onImportZip: (filePath: string) => Promise<void>
  onPickFile: () => Promise<string | null>
}

export const LocalArchiveBackupToolbar: React.FC<LocalArchiveBackupToolbarProps> = ({
  onExportZip,
  onImportZip,
  onPickFile
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useToast()
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const filePath = await onExportZip()
      if (filePath) {
        toast.showSuccess(
          t('settings.export_success_desc', {
            defaultValue: '备份 ZIP 文件已保存在:\n{{path}}',
            path: filePath
          })
        )
      }
    } catch (e: unknown) {
      toast.showError(
        t('settings.export_failed', { error: formatExportErrorMessage(e, t) })
      )
    } finally {
      setIsExporting(false)
    }
  }

  const handleImport = async () => {
    const filePath = await onPickFile()
    if (!filePath) return

    const confirmed = await dialog.confirm(
      t('settings.confirm_restore_desc', '引入备份将覆盖当前所有数据，此操作不可恢复！确认继续？')
    )
    if (!confirmed) return

    setIsImporting(true)
    let willReload = false
    try {
      await onImportZip(filePath)
      toast.showSuccess(t('settings.restore_success_simple', '恢复成功'))
      willReload = true
      setTimeout(() => window.location.reload(), 1500)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.showError(t('settings.restore_failed', { error: message }))
    } finally {
      if (!willReload) setIsImporting(false)
    }
  }

  const busy = isExporting || isImporting

  return (
    <>
      <RestoreBlockingOverlay
        visible={isImporting || isExporting}
        message={
          isExporting
            ? t('settings.exporting_data', '正在导出数据...')
            : undefined
        }
      />
      <div className={styles.localArchiveToolbar}>
        <span className={styles.localArchiveLabel}>
          {t('settings.local_archive_backup', '本地全量备份')}
        </span>
        <Tooltip
          content={t(
            'settings.local_archive_backup_desc',
            '导出或导入包含全部数据的 ZIP 文件，适合换机或离线备份'
          )}
        >
          <span className={styles.helpIconWrapper}>
            <HelpCircle size={16} className={styles.helpIcon} />
          </span>
        </Tooltip>
        <Tooltip content={t('settings.export_desc', '将所有数据导出为 ZIP 压缩包')}>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.btnOutlined} ${styles.localArchiveBtn}`}
            onClick={() => void handleExport()}
            disabled={busy}
            aria-label={t('settings.export_data', '导出数据')}
          >
            {isExporting ? (
              <Loader2 size={16} className={styles.spinIcon} />
            ) : (
              <Download size={16} />
            )}
            {t('settings.export_data', '导出数据')}
          </button>
        </Tooltip>
        <Tooltip content={t('settings.import_desc', '从 ZIP 备份文件恢复数据（将覆盖当前数据）')}>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.btnOutlined} ${styles.localArchiveBtn}`}
            onClick={() => void handleImport()}
            disabled={busy}
            aria-label={t('settings.import_data', '导入数据')}
          >
            {isImporting ? <Loader2 size={16} className={styles.spinIcon} /> : <Upload size={16} />}
            {t('settings.import_data', '导入数据')}
          </button>
        </Tooltip>
      </div>
    </>
  )
}
