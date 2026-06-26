import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MdOutlineStorage,
  MdOutlineDownload,
  MdOutlineUploadFile,
  MdChevronRight
} from 'react-icons/md'
import { useDialog } from '../Dialog'
import { useToast } from '../Toast/useToast'
import '../shared/SettingsListTile.css'
import { SettingsExpansionTile } from '../shared/SettingsExpansionTile'
import { RestoreBlockingOverlay } from '../RestoreBlockingOverlay'
import { formatExportErrorMessage } from '../archive-export.util'

export interface DataManagementCardProps {
  onExportZip?: () => Promise<string | null | undefined>
  onImportZip?: (filePath: string) => Promise<void>
  onExport?: () => void
  onImport?: () => Promise<void>
  onPickFile?: () => Promise<string | null>
  onImportProgress?: (callback: (detail: string) => void) => () => void
  /** 平铺展示导入/导出，不包在可折叠区块内 */
  flat?: boolean
}

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

export const DataManagementCard: React.FC<DataManagementCardProps> = ({
  onExportZip,
  onImportZip,
  onPickFile,
  onImportProgress,
  flat = false
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
      const filePath = await onExportZip?.()
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
    if (!onPickFile) return
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
      await onImportZip!(filePath)
      toast.showSuccess(t('settings.restore_success_simple', '恢复成功'))
      willReload = true
      setTimeout(() => window.location.reload(), 1500)
    } catch (e: any) {
      toast.showError(t('settings.restore_failed', { error: e.message }))
    } finally {
      if (!willReload) setImportProgressDetail(null)
      if (!willReload) setIsImporting(false)
    }
  }

  return (
    <>
      <RestoreBlockingOverlay
        visible={isImporting || isExporting}
        hint={
          isExporting
            ? t('settings.exporting_data', '正在导出数据...')
            : importProgressDetail ??
              t('settings.restoring_data_hint', '请勿关闭应用或进行其他操作，恢复完成后将自动刷新')
        }
        message={
          isExporting
            ? t('settings.exporting_data', '正在导出数据...')
            : undefined
        }
      />
      {flat ? (
        <div className="about-settings-wrapper">
          <button
            className="settings-list-tile"
            onClick={handleExport}
            disabled={isExporting || isImporting}
          >
            <div className="settings-list-tile-leading">
              <MdOutlineDownload size={22} />
            </div>
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">
                {t('settings.export_data', '导出数据')}
              </span>
              <span className="settings-list-tile-subtitle">
                {t('settings.export_desc', '将所有数据导出为 ZIP 压缩包')}
              </span>
            </div>
            <MdChevronRight size={22} className="settings-list-tile-trailing" />
          </button>

          <div className="settings-list-divider" />

          <button
            className="settings-list-tile"
            onClick={handleImport}
            disabled={isExporting || isImporting || !onPickFile}
          >
            <div className="settings-list-tile-leading">
              <MdOutlineUploadFile size={22} />
            </div>
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">
                {t('settings.import_data', '导入数据')}
              </span>
              <span className="settings-list-tile-subtitle">
                {t('settings.import_desc', '从 ZIP 备份文件恢复数据（将覆盖当前数据）')}
              </span>
            </div>
            <MdChevronRight size={22} className="settings-list-tile-trailing" />
          </button>
        </div>
      ) : (
        <SettingsExpansionTile
          icon={<MdOutlineStorage size={24} />}
          title={t('settings.data_management', '数据管理')}
          subtitle={t('settings.data_management_desc', '导出、导入和恢复数据')}
        >
          {/* 导出数据 */}
          <button
            className="settings-list-tile"
            onClick={handleExport}
            disabled={isExporting || isImporting}
          >
            <div className="settings-list-tile-leading">
              <MdOutlineDownload size={22} />
            </div>
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">
                {t('settings.export_data', '导出数据')}
              </span>
              <span className="settings-list-tile-subtitle">
                {t('settings.export_desc', '将所有数据导出为 ZIP 压缩包')}
              </span>
            </div>
            <MdChevronRight size={22} className="settings-list-tile-trailing" />
          </button>

          <div className="settings-list-divider indent" />

          {/* 导入数据 */}
          <button
            className="settings-list-tile"
            onClick={handleImport}
            disabled={isExporting || isImporting || !onPickFile}
          >
            <div className="settings-list-tile-leading">
              <MdOutlineUploadFile size={22} />
            </div>
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">
                {t('settings.import_data', '导入数据')}
              </span>
              <span className="settings-list-tile-subtitle">
                {t('settings.import_desc', '从 ZIP 备份文件恢复数据（将覆盖当前数据）')}
              </span>
            </div>
            <MdChevronRight size={22} className="settings-list-tile-trailing" />
          </button>
        </SettingsExpansionTile>
      )}
    </>
  )
}
