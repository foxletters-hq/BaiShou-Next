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

const SECTION_DESCRIPTIONS: Record<LegacyMigrationSectionId, string> = {
  avatar: '从旧版目录 config/ 或本机「文档/avatars」恢复头像，导入后覆盖当前头像。',
  identityCards: '以新身份卡追加导入；名称后自动加两位数字，避免与现有身份重名。',
  config: '合并旧版 AI 供应商、工具开关等偏好设置，不覆盖你已在新版修改过的项。',
  diaries: '导入 Markdown 日记；若同一天已有内容则追加，不会覆盖。',
  assistants: '追加导入伙伴；名称后加两位数字，避免同名冲突。',
  chatMessages: '导入聊天记录并绑定到本次新导入的伙伴（需同时勾选伙伴）。',
  workspaces: '登记旧版 Vault 并复制附件、归档等内容，不切换当前存储根目录。'
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

function formatDisplayPath(path: string): string {
  return path.replace(/\//g, '\\')
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
    <div className="legacy-migration-pane settings-pane settings-pane-full">
      <header className="legacy-migration-header">
        <h2>{t('legacy_migration.title', '版本迁移')}</h2>
        <p className="legacy-migration-lead">
          {t(
            'legacy_migration.subtitle',
            '从旧版 Flutter 白守恢复数据。请选择旧版工作区根目录（通常包含 Personal、.baishou 等文件夹），再勾选需要导入的板块。'
          )}
        </p>
      </header>

      <section className="legacy-migration-card legacy-migration-source-card">
        <div className="legacy-migration-card-head">
          <h3>{t('legacy_migration.source_title', '旧版工作区')}</h3>
          <span
            className={`legacy-migration-badge ${sourceDir.trim() ? 'legacy-migration-badge--ok' : ''}`}
          >
            {sourceDir.trim()
              ? t('legacy_migration.source_ready', '已选择')
              : t('legacy_migration.source_missing', '未选择')}
          </span>
        </div>
        <p className="legacy-migration-card-desc">
          {t(
            'legacy_migration.source_hint',
            '默认路径为「文档/BaiShou_Root」，若你曾自定义存储位置，请手动选择对应文件夹。头像与配置也可能存放在本机 Flutter 配置目录中，扫描时会自动合并。'
          )}
        </p>
        <div className="legacy-migration-path-box" title={sourceDir || undefined}>
          {sourceDir ? (
            formatDisplayPath(sourceDir)
          ) : (
            <span className="legacy-migration-path-placeholder">
              {t(
                'legacy_migration.no_source',
                '尚未检测到旧版数据目录，请点击下方按钮选择或确认旧版已安装。'
              )}
            </span>
          )}
        </div>
        <div className="legacy-migration-actions">
          <button
            type="button"
            className="legacy-migration-btn legacy-migration-btn--primary"
            onClick={() => void handlePickSource()}
            disabled={scanning || importing}
          >
            {t('legacy_migration.pick_source', '选择旧版目录')}
          </button>
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
        </div>
        {scanResult?.candidatePaths && scanResult.candidatePaths.length > 0 ? (
          <div className="legacy-migration-candidates">
            <span className="legacy-migration-candidates-label">
              {t('legacy_migration.detected_paths', '自动检测到的目录：')}
            </span>
            <div className="legacy-migration-candidate-list">
              {scanResult.candidatePaths.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`legacy-migration-candidate-chip ${p === sourceDir ? 'is-active' : ''}`}
                  disabled={scanning || importing}
                  onClick={() => void handleSelectCandidate(p)}
                  title={p}
                >
                  {formatDisplayPath(p)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {scanResult?.notes && scanResult.notes.length > 0 ? (
        <section className="legacy-migration-card legacy-migration-notes-card">
          <h3>{t('legacy_migration.notes_title', '说明')}</h3>
          <ul>
            {scanResult.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="legacy-migration-sections">
        <h3 className="legacy-migration-sections-title">
          {t('legacy_migration.sections_title', '可导入内容')}
        </h3>
        <div className="legacy-migration-section-grid">
          {SECTION_ORDER.map((id) => {
            const section = sectionsById.get(id)
            if (!section) return null
            const checked = Boolean(selection[sectionKeyToSelectionKey(id)])
            const disabled = !section.importable || importing
            return (
              <label
                key={id}
                className={`legacy-migration-card legacy-migration-section-card ${
                  disabled && !section.importable ? 'is-disabled' : ''
                } ${checked ? 'is-selected' : ''}`}
              >
                <div className="legacy-migration-section-card-top">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled || !section.importable}
                    onChange={(e) => toggleSection(id, e.target.checked)}
                  />
                  <div className="legacy-migration-section-card-head">
                    <span className="legacy-migration-section-name">
                      {section.label || SECTION_LABELS[id]}
                    </span>
                    <span
                      className={`legacy-migration-status ${
                        section.detected ? 'is-detected' : 'is-missing'
                      }`}
                    >
                      {section.detected
                        ? t('legacy_migration.detected', '已检测到')
                        : t('legacy_migration.not_detected', '未检测到')}
                    </span>
                  </div>
                </div>
                <p className="legacy-migration-section-desc">{SECTION_DESCRIPTIONS[id]}</p>
                <div className="legacy-migration-section-meta">
                  {t('legacy_migration.section_meta', '{{count}} 项 · {{size}}', {
                    count: section.count,
                    size: section.sizeLabel
                  })}
                </div>
                {section.samples.length > 0 ? (
                  <ul className="legacy-migration-section-samples">
                    {section.samples.map((sample) => (
                      <li key={sample}>{sample}</li>
                    ))}
                  </ul>
                ) : null}
                {section.warnings.length > 0 ? (
                  <ul className="legacy-migration-section-warnings">
                    {section.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ) : null}
              </label>
            )
          })}
        </div>
      </section>

      <footer className="legacy-migration-card legacy-migration-footer-card">
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
        <div className="legacy-migration-actions">
          <button
            type="button"
            className="legacy-migration-btn legacy-migration-btn--primary"
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
      </footer>
    </div>
  )
}
