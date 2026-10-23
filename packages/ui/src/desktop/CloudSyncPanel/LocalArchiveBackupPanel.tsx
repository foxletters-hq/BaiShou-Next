import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDialog } from '../Dialog'
import { useToast } from '../Toast/useToast'
import { Button } from '../Button/Button'
import { RestoreBlockingOverlay } from '../RestoreBlockingOverlay'
import { formatExportErrorMessage } from '../archive-export.util'
import panelStyles from './LocalArchiveBackupPanel.module.css'

function formatImportProgressDetail(detail: string): string {
  const vaultMatch = /^vault:(\d+)\/(\d+):(.+)$/.exec(detail)
  if (vaultMatch) {
    return `正在迁移工作区 ${vaultMatch[1]}/${vaultMatch[2]}：${vaultMatch[3]}`
  }

  const parts = detail.replace(/\\/g, '/').split('/').filter(Boolean)
  if (parts.length > 0) {
    return `正在复制：${parts.slice(-3).join('/')}`
  }
  return detail
}

export interface LocalArchiveBackupPanelProps {
  onExportZip: () => Promise<string | null | undefined>
  onImportZip: (filePath: string) => Promise<void>
  onPickFile: () => Promise<string | null>
  onImportProgress?: (callback: (detail: string) => void) => () => void
}

export const LocalArchiveBackupPanel: React.FC<LocalArchiveBackupPanelProps> = ({
  onExportZip,
  onImportZip,
  onPickFile,
  onImportProgress
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useToast()
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgressDetail, setImportProgressDetail] = useState<string | null>(null)

  useEffect(() => {
    if (!onImportProgress) return
    return onImportProgress((detail) => setImportProgressDetail(formatImportProgressDetail(detail)))
  }, [onImportProgress])

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
      toast.showError(t('settings.export_failed', { error: formatExportErrorMessage(e, t) }))
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
    setImportProgressDetail(null)
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
      if (!willReload) setImportProgressDetail(null)
      if (!willReload) setIsImporting(false)
    }
  }

  const busy = isExporting || isImporting

  return (
    <>
      <RestoreBlockingOverlay
        visible={isImporting || isExporting}
        hint={
          isExporting
            ? t('settings.exporting_data', '正在导出数据...')
            : (importProgressDetail ??
              t('settings.restoring_data_hint', '请勿关闭应用或进行其他操作，恢复完成后将自动刷新'))
        }
        message={isExporting ? t('settings.exporting_data', '正在导出数据...') : undefined}
      />
      <div className={panelStyles.panel}>
        <p className={panelStyles.desc}>
          {t(
            'settings.local_archive_backup_desc',
            '导出或导入包含全部数据的 ZIP 文件，适合换机或离线备份'
          )}
        </p>
        <div className={panelStyles.actions}>
          <Button
            type="button"
            variant="outlined"
            size="small"
            onClick={() => void handleExport()}
            disabled={busy}
            isLoading={isExporting}
          >
            {t('settings.export_data', '导出数据')}
          </Button>
          <Button
            type="button"
            variant="outlined"
            size="small"
            onClick={() => void handleImport()}
            disabled={busy}
            isLoading={isImporting}
          >
            {t('settings.import_data', '导入数据')}
          </Button>
        </div>
      </div>
    </>
  )
}
