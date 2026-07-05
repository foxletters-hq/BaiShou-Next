import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { RestoreBlockingOverlay } from '@baishou/ui'
import { formatMigrationMegabytes } from '@baishou/shared'
import type {
  LegacyVersionMigrationImportStatus,
  LegacyVersionMigrationPreviewItem
} from '@baishou/shared'
import { useDesktopVersionMigration } from '../hooks/useDesktopVersionMigration'
import './LegacyMigrationPane.css'

function formatDisplayPath(path: string): string {
  return path.replace(/\//g, '\\')
}

function SectionCard({
  title,
  meta,
  warnings,
  previewItems,
  previewFormat,
  failureSamples,
  importStatus,
  available,
  importing,
  onImport,
  t
}: {
  title: string
  meta: string
  warnings: string[]
  previewItems?: LegacyVersionMigrationPreviewItem[]
  previewFormat?: 'persona' | 'config' | 'default'
  failureSamples?: string[]
  importStatus: LegacyVersionMigrationImportStatus
  available: boolean
  importing: boolean
  onImport: () => void
  t: TFunction
}) {
  const statusLabel =
    importStatus === 'success'
      ? t('version_migration.status_success', '已导入')
      : importStatus === 'failed'
        ? t('version_migration.status_failed', '导入失败')
        : importStatus === 'importing'
          ? t('version_migration.status_importing', '导入中…')
          : available
            ? t('version_migration.status_ready', '可导入')
            : t('version_migration.status_unavailable', '无数据')

  return (
    <article
      className={`legacy-migration-card legacy-migration-section-card ${importStatus === 'success' ? 'is-imported' : ''}`}
    >
      <div className="legacy-migration-section-card-top">
        <div className="legacy-migration-section-card-head">
          <span className="legacy-migration-section-name">{title}</span>
          <span
            className={`legacy-migration-status ${
              available ? 'is-detected' : 'is-missing'
            } ${importStatus === 'success' ? 'is-imported' : ''}`}
          >
            {statusLabel}
          </span>
        </div>
        <p className="legacy-migration-section-meta">{meta}</p>
      </div>

      {previewItems && previewItems.length > 0 ? (
        <ul className="legacy-migration-section-samples">
          {previewItems.map((item, index) => (
            <li key={`${item.label}-${index}`}>
              {previewFormat === 'persona'
                ? t('version_migration.persona_preview_line', {
                    name: item.label,
                    count: Number(item.detail ?? 0),
                    defaultValue: `${item.label} · ${item.detail ?? 0} 个属性`
                  })
                : previewFormat === 'config'
                  ? t(item.label)
                  : item.detail
                    ? `${item.label} · ${item.detail}`
                    : item.label}
            </li>
          ))}
        </ul>
      ) : null}

      {failureSamples && failureSamples.length > 0 ? (
        <ul className="legacy-migration-section-warnings legacy-migration-failure-list">
          <li className="legacy-migration-failure-title">
            {t('version_migration.failure_samples_title', '部分条目导入失败：')}
          </li>
          {failureSamples.slice(0, 8).map((sample, index) => (
            <li key={`fail-${index}`}>{sample}</li>
          ))}
          {failureSamples.length > 8 ? (
            <li>
              {t('version_migration.failure_samples_more', {
                count: failureSamples.length - 8,
                defaultValue: `还有 ${failureSamples.length - 8} 条未显示`
              })}
            </li>
          ) : null}
        </ul>
      ) : null}

      {warnings.map((warningKey) => (
        <p key={warningKey} className="legacy-migration-section-hint">
          {t(warningKey)}
        </p>
      ))}

      <div className="legacy-migration-section-footer">
        <button
          type="button"
          className="legacy-migration-btn legacy-migration-btn--primary legacy-migration-btn--compact"
          disabled={!available || importing}
          onClick={onImport}
        >
          {t('version_migration.import_action', '导入')}
        </button>
      </div>
    </article>
  )
}

export const LegacyMigrationPane: React.FC = () => {
  const { t } = useTranslation()
  const {
    apiAvailable,
    scanning,
    scanResult,
    globalSections,
    workspaceSections,
    importingSection,
    importProgress,
    customSourceRoot,
    legacySourceKindKey,
    inPlace,
    refreshScan,
    handlePickSource,
    handleClearCustomSource,
    handleImportSection,
    handleImportAllWorkspaces
  } = useDesktopVersionMigration()

  const overlayVisible = importingSection != null
  const hasScanContent = globalSections.length > 0 || workspaceSections.length > 0
  const showSectionScanSpinner = scanning && !hasScanContent
  const importableWorkspaces = workspaceSections.filter((ws) => ws.available)

  if (!apiAvailable) {
    return (
      <div className="legacy-migration-pane settings-pane settings-pane-full">
        <p className="legacy-migration-error">
          {t('legacy_migration.api_unavailable', '迁移 API 不可用')}
        </p>
      </div>
    )
  }

  return (
    <div className="legacy-migration-pane settings-pane settings-pane-full">
      <RestoreBlockingOverlay
        visible={overlayVisible}
        message={t('version_migration.importing', '正在导入旧版数据…')}
        hint={
          importProgress
            ? t('version_migration.importing_item', {
                name: importProgress,
                defaultValue: `正在处理：${importProgress}`
              })
            : t('version_migration.importing_hint', '请勿关闭应用')
        }
      />

      <header className="legacy-migration-header">
        <h2>{t('version_migration.title', '版本迁移')}</h2>
        <p className="legacy-migration-lead">
          {t(
            'version_migration.description',
            '检测旧版白守数据，按板块查看体积并选择导入。导入过程不会删除旧版目录。'
          )}
        </p>
      </header>

      <section className="legacy-migration-card legacy-migration-source-card">
        <p className="legacy-migration-card-desc">
          {t(
            'version_migration.import_order_hint',
            '推荐顺序：全局（头像/身份卡/配置）→ 各工作空间（日记 + 伙伴与会话）'
          )}
        </p>
        <div className="legacy-migration-actions">
          <button
            type="button"
            className="legacy-migration-btn legacy-migration-btn--primary"
            onClick={() => void handlePickSource()}
            disabled={scanning}
          >
            {t('version_migration.choose_legacy_directory', '选择旧版目录')}
          </button>
          {customSourceRoot ? (
            <button
              type="button"
              className="legacy-migration-btn"
              onClick={() => void handleClearCustomSource()}
              disabled={scanning}
            >
              {t('version_migration.clear_custom_legacy_directory', '恢复自动检测')}
            </button>
          ) : null}
          <button
            type="button"
            className="legacy-migration-btn"
            onClick={() => void refreshScan()}
            disabled={scanning}
          >
            {scanning
              ? t('version_migration.scanning', '正在扫描…')
              : t('version_migration.rescan', '重新扫描')}
          </button>
        </div>

        {scanResult ? (
          <>
            {inPlace ? (
              <p className="legacy-migration-source-kind">
                {t(
                  'version_migration.in_place_notice',
                  '旧版数据与当前工作区目录相同，将在此目录原位转换数据结构（不会复制到新文件夹）。'
                )}
              </p>
            ) : null}
            {legacySourceKindKey ? (
              <p className="legacy-migration-source-kind">{t(legacySourceKindKey)}</p>
            ) : null}
            <div className="legacy-migration-path-box" title={scanResult.sourceDisplayPath}>
              {t('version_migration.source_path', '旧版目录：{{path}}', {
                path: formatDisplayPath(scanResult.sourceDisplayPath)
              })}
            </div>
          </>
        ) : (
          <div className="legacy-migration-path-box">
            <span className="legacy-migration-path-placeholder">
              {t(
                'version_migration.no_legacy_data',
                '未检测到可迁移的旧版数据。若您刚升级，请确认旧版目录仍可访问，或手动选择旧版 Flutter 数据目录。'
              )}
            </span>
          </div>
        )}
      </section>

      {showSectionScanSpinner ? (
        <div className="legacy-migration-loading">
          {t('version_migration.scanning', '正在扫描…')}
        </div>
      ) : null}

      {globalSections.length > 0 ? (
        <section className="legacy-migration-group">
          <h3 className="legacy-migration-group-title">
            {t('version_migration.global_group_title', '全局数据')}
          </h3>
          <div className="legacy-migration-section-grid">
            {globalSections.map((section) => (
              <SectionCard
                key={section.sectionId}
                title={t(section.titleKey)}
                meta={t('version_migration.section_meta', '{{count}} 项 · {{size}}', {
                  count: section.count,
                  size: formatMigrationMegabytes(section.bytes)
                })}
                warnings={section.warnings}
                previewItems={section.previewItems}
                previewFormat={
                  section.sectionId === 'personas'
                    ? 'persona'
                    : section.sectionId === 'config'
                      ? 'config'
                      : 'default'
                }
                failureSamples={section.failureSamples}
                importStatus={section.importStatus}
                available={section.available}
                importing={importingSection != null}
                onImport={() => void handleImportSection(section.sectionId)}
                t={t}
              />
            ))}
          </div>
        </section>
      ) : null}

      {workspaceSections.length > 0 ? (
        <section className="legacy-migration-group">
          <div className="legacy-migration-workspace-header">
            <h3 className="legacy-migration-group-title">
              {t('version_migration.workspace_group_title', '工作空间')}
            </h3>
            {importableWorkspaces.length > 1 ? (
              <button
                type="button"
                className="legacy-migration-btn"
                disabled={importingSection != null}
                onClick={() => void handleImportAllWorkspaces()}
              >
                {t('version_migration.import_all_workspaces', '导入全部工作空间')}
              </button>
            ) : null}
          </div>
          <div className="legacy-migration-section-grid">
            {workspaceSections.map((workspace) => {
              const totalBytes =
                workspace.diaryBytes + workspace.archiveBytes + workspace.agentBytes
              return (
                <SectionCard
                  key={workspace.sectionId}
                  title={workspace.legacyVaultName}
                  meta={t('version_migration.workspace_meta', {
                    diaries: workspace.diaryCount,
                    summaries: workspace.archiveCount,
                    assistants: workspace.assistantCount,
                    sessions: workspace.sessionCount,
                    size: formatMigrationMegabytes(totalBytes)
                  })}
                  warnings={workspace.warnings}
                  previewItems={workspace.previewItems}
                  failureSamples={workspace.failureSamples}
                  importStatus={workspace.importStatus}
                  available={workspace.available}
                  importing={importingSection != null}
                  onImport={() => void handleImportSection(workspace.sectionId)}
                  t={t}
                />
              )
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}
