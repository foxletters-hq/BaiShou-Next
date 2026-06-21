import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Loader2, Upload } from 'lucide-react'
import { useDialog } from '../Dialog'
import { useToast } from '../Toast/useToast'
import { RestoreBlockingOverlay } from '../RestoreBlockingOverlay'
import panelStyles from './LocalArchiveBackupPanel.module.css'
import styles from './CloudSyncPanel.module.css'

export interface LocalArchiveBackupPanelProps {
  onExportZip: () => Promise<void>
  onImportZip: (filePath: string) => Promise<void>
  onPickFile: () => Promise<string | null>
}

export const LocalArchiveBackupPanel: React.FC<LocalArchiveBackupPanelProps> = ({
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
      await onExportZip()
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
      <RestoreBlockingOverlay visible={isImporting} />
      <div className={panelStyles.panel}>
        <p className={panelStyles.desc}>
          {t(
            'settings.local_archive_backup_desc',
            '导出或导入包含全部数据的 ZIP 文件，适合换机或离线备份'
          )}
        </p>
        <div className={panelStyles.actions}>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.btnOutlined} ${panelStyles.btn}`}
            onClick={() => void handleExport()}
            disabled={busy}
          >
            {isExporting ? (
              <Loader2 size={16} className={panelStyles.spinIcon} />
            ) : (
              <Download size={16} />
            )}
            {t('settings.export_data', '导出数据')}
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.btnOutlined} ${panelStyles.btn}`}
            onClick={() => void handleImport()}
            disabled={busy}
          >
            {isImporting ? (
              <Loader2 size={16} className={panelStyles.spinIcon} />
            ) : (
              <Upload size={16} />
            )}
            {t('settings.import_data', '导入数据')}
          </button>
        </div>
      </div>
    </>
  )
}
