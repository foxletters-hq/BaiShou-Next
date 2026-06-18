import React from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  scrollIndicatorStyle,
  KeyboardAwareScrollView,
  useNativeTheme,
  Button,
  RestoreBlockingOverlay,
  StoragePermissionPrompt
} from '@baishou/ui/native'
import { formatMigrationMegabytes } from '@baishou/core-mobile'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { DirectoryPickerModal } from '../../components/DirectoryPickerModal'
import { useVersionMigration } from '../../hooks/useVersionMigration'
import { EXTERNAL_STORAGE_ROOT } from '../../services/storage-permission.service'

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
  colors,
  tokens,
  t
}: {
  title: string
  meta: string
  warnings: string[]
  previewItems?: Array<{ label: string; detail?: string }>
  previewFormat?: 'persona' | 'config' | 'default'
  failureSamples?: string[]
  importStatus: string
  available: boolean
  importing: boolean
  onImport: () => void
  colors: ReturnType<typeof useNativeTheme>['colors']
  tokens: ReturnType<typeof useNativeTheme>['tokens']
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  return (
    <View
      style={[styles.sectionCard, { backgroundColor: colors.bgSurface, borderRadius: tokens.radius.lg }]}
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.sectionMeta, { color: colors.textSecondary }]}>{meta}</Text>
      </View>

      {previewItems && previewItems.length > 0 ? (
        <View style={styles.previewList}>
          {previewItems.map((item, index) => (
            <Text
              key={`${item.label}-${index}`}
              style={[styles.previewItem, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
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
            </Text>
          ))}
        </View>
      ) : null}

      {failureSamples && failureSamples.length > 0 ? (
        <View style={styles.previewList}>
          <Text style={[styles.failureTitle, { color: colors.error }]}>
            {t('version_migration.failure_samples_title', '部分条目导入失败：')}
          </Text>
          {failureSamples.slice(0, 8).map((sample, index) => (
            <Text
              key={`fail-${index}`}
              style={[styles.previewItem, { color: colors.textTertiary }]}
              numberOfLines={2}
            >
              {sample}
            </Text>
          ))}
          {failureSamples.length > 8 ? (
            <Text style={[styles.previewItem, { color: colors.textTertiary }]}>
              {t('version_migration.failure_samples_more', {
                count: failureSamples.length - 8,
                defaultValue: `还有 ${failureSamples.length - 8} 条未显示`
              })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {warnings.map((warningKey) => (
        <Text key={warningKey} style={[styles.warning, { color: colors.textTertiary }]}>
          {t(warningKey)}
        </Text>
      ))}

      <View style={styles.sectionFooter}>
        <Text style={[styles.statusText, { color: colors.textTertiary }]}>
          {importStatus === 'success'
            ? t('version_migration.status_success', '已导入')
            : importStatus === 'failed'
              ? t('version_migration.status_failed', '导入失败')
              : importStatus === 'importing'
                ? t('version_migration.status_importing', '导入中…')
                : available
                  ? t('version_migration.status_ready', '可导入')
                  : t('version_migration.status_unavailable', '无数据')}
        </Text>
        <Pressable
          disabled={!available || importing}
          onPress={onImport}
          style={({ pressed }) => [
            styles.importBtn,
            {
              backgroundColor: available ? colors.primary : colors.borderMuted,
              opacity: pressed ? 0.85 : 1
            }
          ]}
        >
          <Text style={styles.importBtnText}>{t('version_migration.import_action', '导入')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

export const VersionMigrationScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors, isDark, tokens } = useNativeTheme()
  const chrome = getStackScreenChrome(colors)
  const {
    pageReady,
    scanning,
    scanResult,
    globalSections,
    workspaceSections,
    importingSection,
    importProgress,
    refreshScan,
    handleImportSection,
    handleImportAllWorkspaces,
    allFilesAccessGranted,
    handleRequestAllFilesAccess,
    dbUnavailable,
    customLegacySourceRoot,
    legacySourceKindKey,
    handleChooseLegacyDirectory,
    handleClearCustomLegacyDirectory,
    pickerVisible,
    closeDirectoryPicker,
    handleDirectorySelected,
    fileSystem
  } = useVersionMigration()

  const overlayVisible = importingSection != null
  const hasScanContent = globalSections.length > 0 || workspaceSections.length > 0
  const showSectionScanSpinner = pageReady && scanning && !hasScanContent
  const importableWorkspaces = workspaceSections.filter((ws) => ws.available)

  return (
    <StackScreenLayout
      title={t('version_migration.title', '版本迁移')}
      {...chrome}
      contentStyle={styles.layoutContent}
    >
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

      <DirectoryPickerModal
        visible={pickerVisible}
        fileSystem={fileSystem}
        initialPath={Platform.OS === 'android' ? EXTERNAL_STORAGE_ROOT : undefined}
        onClose={closeDirectoryPicker}
        onSelect={(path) => void handleDirectorySelected(path)}
      />

      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        indicatorStyle={scrollIndicatorStyle(isDark)}
      >
        <View style={[styles.card, { backgroundColor: colors.bgSurface, borderRadius: tokens.radius.lg }]}>
          <Text style={[styles.desc, { color: colors.textSecondary }]}>
            {t(
              'version_migration.description',
              '检测旧版白守数据，按板块查看体积并选择导入。导入过程不会删除旧版目录。'
            )}
          </Text>
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            {t(
              'version_migration.import_order_hint',
              '推荐顺序：全局（头像/身份卡/配置）→ 各工作空间（日记 + 伙伴与会话）'
            )}
          </Text>
          {handleRequestAllFilesAccess && allFilesAccessGranted === false ? (
            <StoragePermissionPrompt onRequest={handleRequestAllFilesAccess} mode="required" />
          ) : null}

          <View style={styles.sourceActions}>
            <Button
              variant="outline"
              className="flex-1"
              style={{ backgroundColor: colors.bgSurface }}
              onPress={() => void handleChooseLegacyDirectory()}
              disabled={!pageReady || scanning}
            >
              {t('version_migration.choose_legacy_directory', '选择旧版目录')}
            </Button>
            {customLegacySourceRoot ? (
              <Button
                variant="outline"
                className="flex-1"
                style={{ backgroundColor: colors.bgSurface }}
                onPress={() => void handleClearCustomLegacyDirectory()}
                disabled={scanning}
              >
                {t('version_migration.clear_custom_legacy_directory', '恢复自动检测')}
              </Button>
            ) : null}
          </View>

          {scanResult ? (
            <>
              {legacySourceKindKey ? (
                <Text style={[styles.hint, { color: colors.textTertiary }]}>{t(legacySourceKindKey)}</Text>
              ) : null}
              <Text style={[styles.mono, { color: colors.textTertiary }]} selectable>
                {t('version_migration.source_path', '旧版目录：{{path}}', {
                  path: scanResult.sourceDisplayPath
                })}
              </Text>
            </>
          ) : null}

          <Button
            variant="outline"
            className="w-full"
            style={{ backgroundColor: colors.bgSurface, marginTop: 4 }}
            onPress={() => void refreshScan()}
            disabled={!pageReady || scanning}
          >
            {scanning
              ? t('version_migration.scanning', '正在扫描…')
              : t('version_migration.rescan', '重新扫描')}
          </Button>
        </View>

        {showSectionScanSpinner ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textSecondary }}>
              {t('version_migration.scanning', '正在扫描…')}
            </Text>
          </View>
        ) : null}

        {pageReady && !scanning && dbUnavailable ? (
          <View
            style={[styles.card, { backgroundColor: colors.bgSurface, borderRadius: tokens.radius.lg }]}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
              {t('version_migration.db_not_ready', '数据库尚未就绪，请稍候后重新扫描。')}
            </Text>
          </View>
        ) : null}

        {pageReady && !scanning && !dbUnavailable && !scanResult ? (
          <View
            style={[styles.card, { backgroundColor: colors.bgSurface, borderRadius: tokens.radius.lg }]}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
              {t(
                'version_migration.no_legacy_data',
                '未检测到可迁移的旧版数据。若您刚升级，请确认旧版目录仍可访问，或手动选择旧版 Flutter 数据目录。'
              )}
            </Text>
          </View>
        ) : null}

        {globalSections.length > 0 ? (
          <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>
            {t('version_migration.global_group_title', '全局数据')}
          </Text>
        ) : null}

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
            colors={colors}
            tokens={tokens}
            t={t}
          />
        ))}

        {workspaceSections.length > 0 ? (
          <View style={styles.workspaceHeader}>
            <Text style={[styles.groupTitle, { color: colors.textSecondary, marginBottom: 0 }]}>
              {t('version_migration.workspace_group_title', '工作空间')}
            </Text>
            {importableWorkspaces.length > 1 ? (
              <Button
                variant="outline"
                style={{ backgroundColor: colors.bgSurface }}
                onPress={() => void handleImportAllWorkspaces()}
                disabled={importingSection != null}
              >
                {t('version_migration.import_all_workspaces', '导入全部工作空间')}
              </Button>
            ) : null}
          </View>
        ) : null}

        {workspaceSections.map((workspace) => {
          const totalBytes = workspace.diaryBytes + workspace.archiveBytes + workspace.agentBytes
          return (
            <SectionCard
              key={workspace.sectionId}
              title={workspace.legacyVaultName}
              meta={t('version_migration.workspace_meta', {
                diaries: workspace.diaryCount,
                summaries: workspace.archiveCount,
                assistants: workspace.assistantCount,
                sessions: workspace.sessionCount,
                size: formatMigrationMegabytes(totalBytes),
                defaultValue: `${workspace.diaryCount} 篇日记 · ${workspace.archiveCount} 篇总结 · ${workspace.assistantCount} 伙伴 · ${workspace.sessionCount} 会话 · ${formatMigrationMegabytes(totalBytes)}`
              })}
              warnings={workspace.warnings}
              previewItems={workspace.previewItems}
              failureSamples={workspace.failureSamples}
              importStatus={workspace.importStatus}
              available={workspace.available}
              importing={importingSection != null}
              onImport={() => void handleImportSection(workspace.sectionId)}
              colors={colors}
              tokens={tokens}
              t={t}
            />
          )
        })}
      </KeyboardAwareScrollView>
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  layoutContent: {
    flex: 1
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    padding: 12,
    gap: 12,
    paddingBottom: 32
  },
  card: {
    padding: 14,
    gap: 8
  },
  desc: {
    fontSize: 14,
    lineHeight: 20
  },
  hint: {
    fontSize: 12,
    lineHeight: 18
  },
  mono: {
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18
  },
  sourceActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    justifyContent: 'center'
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: -4,
    marginTop: 4
  },
  workspaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4
  },
  sectionCard: {
    padding: 14,
    gap: 8
  },
  sectionHeader: {
    gap: 4
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600'
  },
  sectionMeta: {
    fontSize: 13
  },
  previewList: {
    gap: 2
  },
  previewItem: {
    fontSize: 13
  },
  failureTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4
  },
  warning: {
    fontSize: 12,
    lineHeight: 18
  },
  sectionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4
  },
  statusText: {
    fontSize: 12,
    flex: 1,
    marginRight: 12
  },
  importBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  importBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  }
})
