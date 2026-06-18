import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  LegacyMigrationImportResult,
  LegacyMigrationImportSelection,
  LegacyMigrationScanResult,
  LegacyMigrationSectionId,
  LegacyMigrationSectionPreview
} from '@baishou/shared'
import './LegacyMigrationPane.css'

const SECTION_LABELS: Record<LegacyMigrationSectionId, string> = {
  avatar: '用户头像',
  identityCards: '身份卡',
  config: '配置',
  diaries: '日记',
  assistants: '伙伴',
  chatMessages: '聊天记录',
  workspaces: '工作空间'
}

const SECTION_ORDER: LegacyMigrationSectionId[] = [
  'avatar',
  'identityCards',
  'config',
  'diaries',
  'assistants',
  'chatMessages',
  'workspaces'
]

const EMPTY_SELECTION: LegacyMigrationImportSelection = {
  avatar: false,
  identityCards: false,
  config: false,
  diaries: false,
  assistants: false,
  chatMessages: false,
  workspaces: false
}

function sectionKeyToSelectionKey(
  id: LegacyMigrationSectionId
): keyof LegacyMigrationImportSelection {
  return id
}

export const LegacyMigrationPane: React.FC = () => {
  const { t } = useTranslation()
  const [scanResult, setScanResult] = useState<LegacyMigrationScanResult | null>(null)
  const [sourceDir, setSourceDir] = useState('')
  const [selection, setSelection] = useState<LegacyMigrationImportSelection>(EMPTY_SELECTION)
  const [scanning, setScanning] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progressMessage, setProgressMessage] = useState('')
  const [importResult, setImportResult] = useState<LegacyMigrationImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const api = window.api?.legacyMigration

  const runScan = useCallback(
    async (dir?: string) => {
      if (!api) {
        setError(t('legacy_migration.api_unavailable', '迁移 API 不可用'))
        return
      }
      setScanning(true)
      setError(null)
      setImportResult(null)
      try {
        const result = await api.scan(dir?.trim() || undefined)
        setScanResult(result)
        setSourceDir(result.sourceDir)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setScanning(false)
      }
    },
    [api, t]
  )

  useEffect(() => {
    void runScan()
  }, [runScan])

  useEffect(() => {
    if (!api) return
    const unsubscribe = api.onProgress((event) => {
      setProgressMessage(event.message)
    })
    return unsubscribe
  }, [api])

  const sectionsById = useMemo(() => {
    const map = new Map<LegacyMigrationSectionId, LegacyMigrationSectionPreview>()
    for (const section of scanResult?.sections ?? []) {
      map.set(section.id, section)
    }
    return map
  }, [scanResult])

  const toggleSection = (id: LegacyMigrationSectionId, checked: boolean) => {
    setSelection((prev) => {
      const next = { ...prev, [sectionKeyToSelectionKey(id)]: checked }
      if (id === 'chatMessages' && checked) {
        next.assistants = true
      }
      if (id === 'assistants' && !checked && prev.chatMessages) {
        next.chatMessages = false
      }
      return next
    })
  }

  const handlePickSource = async () => {
    if (!api) return
    try {
      const picked = await api.pickSource()
      if (picked) {
        setSourceDir(picked)
        await runScan(picked)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleSelectCandidate = async (path: string) => {
    setSourceDir(path)
    await runScan(path)
  }

  const hasSelection = Object.values(selection).some(Boolean)

  const handleImport = async () => {
    if (!api || !sourceDir.trim() || !hasSelection) return
    setImporting(true)
    setError(null)
    setImportResult(null)
    setProgressMessage(t('legacy_migration.import_starting', '正在开始导入…'))
    try {
      const result = await api.import(sourceDir, selection)
      setImportResult(result)
      setProgressMessage(
        result.cancelled
          ? t('legacy_migration.import_cancelled', '导入已取消（已完成部分可能已写入）')
          : t('legacy_migration.import_done', '导入完成')
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setImporting(false)
    }
  }

  const handleCancel = () => {
    void api?.cancel()
  }

  return (
    <div className="legacy-migration-pane settings-pane">
      <div className="legacy-migration-header">
        <h2>{t('legacy_migration.title', '版本迁移')}</h2>
        <p>
          {t(
            'legacy_migration.subtitle',
            '从旧版 Flutter 白守导入头像、身份卡、配置、日记、伙伴与聊天记录。导入为追加/合并模式，不会清空现有数据。'
          )}
        </p>
      </div>

      <div className="legacy-migration-source">
        <div className="legacy-migration-source-path">
          {sourceDir ||
            t('legacy_migration.no_source', '尚未检测到旧版数据目录，请手动选择或确认旧版已安装。')}
        </div>
        <div className="legacy-migration-source-actions">
          <button
            type="button"
            className="legacy-migration-btn"
            onClick={() => void runScan(sourceDir)}
            disabled={scanning || importing}
          >
            {scanning
              ? t('legacy_migration.scanning', '扫描中…')
              : t('legacy_migration.rescan', '重新扫描')}
          </button>
          <button
            type="button"
            className="legacy-migration-btn"
            onClick={() => void handlePickSource()}
            disabled={scanning || importing}
          >
            {t('legacy_migration.pick_source', '选择旧版目录')}
          </button>
        </div>
        {scanResult?.candidatePaths && scanResult.candidatePaths.length > 0 ? (
          <ul className="legacy-migration-candidates">
            {scanResult.candidatePaths.map((p) => (
              <li key={p}>
                <button
                  type="button"
                  className="legacy-migration-candidate-btn"
                  disabled={scanning || importing}
                  onClick={() => void handleSelectCandidate(p)}
                >
                  {p}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="legacy-migration-sections">
        {SECTION_ORDER.map((id) => {
          const section = sectionsById.get(id)
          if (!section) return null
          const checked = Boolean(selection[sectionKeyToSelectionKey(id)])
          const disabled = !section.importable || importing
          return (
            <label
              key={id}
              className={`legacy-migration-card ${disabled && !section.importable ? 'disabled' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled || !section.importable}
                onChange={(e) => toggleSection(id, e.target.checked)}
              />
              <div>
                <div className="legacy-migration-card-title">
                  <span>{section.label}</span>
                  {!section.detected ? (
                    <span className="legacy-migration-card-meta">
                      {t('legacy_migration.not_detected', '未检测到')}
                    </span>
                  ) : null}
                </div>
                <div className="legacy-migration-card-meta">
                  {t('legacy_migration.section_meta', '{{count}} 项 · {{size}}', {
                    count: section.count,
                    size: section.sizeLabel
                  })}
                </div>
                {section.samples.length > 0 ? (
                  <ul className="legacy-migration-card-samples">
                    {section.samples.map((sample) => (
                      <li key={sample}>{sample}</li>
                    ))}
                  </ul>
                ) : null}
                {section.warnings.length > 0 ? (
                  <ul className="legacy-migration-card-warnings">
                    {section.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </label>
          )
        })}
      </div>

      <div className="legacy-migration-footer">
        {progressMessage ? (
          <div className="legacy-migration-progress">{progressMessage}</div>
        ) : null}
        {error ? <div className="legacy-migration-error">{error}</div> : null}
        {importResult ? (
          <div className="legacy-migration-results">
            <strong>{t('legacy_migration.import_summary', '导入结果')}</strong>
            <ul>
              {importResult.sections.map((s) => (
                <li key={s.id}>
                  {SECTION_LABELS[s.id]}:{' '}
                  {t(
                    'legacy_migration.section_result',
                    '成功 {{success}} · 跳过 {{skipped}} · 失败 {{failed}}',
                    {
                      success: s.success,
                      skipped: s.skipped,
                      failed: s.failed
                    }
                  )}
                  {s.errors.length > 0 ? ` — ${s.errors.join('; ')}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="legacy-migration-source-actions">
          <button
            type="button"
            className="legacy-migration-btn primary"
            onClick={() => void handleImport()}
            disabled={!hasSelection || !sourceDir || scanning || importing || !api}
          >
            {importing
              ? t('legacy_migration.importing', '导入中…')
              : t('legacy_migration.import_selected', '导入选中项')}
          </button>
          {importing ? (
            <button type="button" className="legacy-migration-btn" onClick={handleCancel}>
              {t('common.cancel', '取消')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
