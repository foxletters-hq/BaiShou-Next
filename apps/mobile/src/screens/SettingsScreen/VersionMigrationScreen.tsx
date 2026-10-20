import React from 'react'
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native'
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
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'
import { VersionMigrationSectionCard as SectionCard } from './VersionMigrationSectionCard'

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
    importBusy,
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
      title={t('version_migration.title', { defaultValue: '版本迁移' })}
      {...chrome}
      contentStyle={styles.layoutContent}
    >
      <RestoreBlockingOverlay
        visible={overlayVisible}
        message={t('version_migration.importing', { defaultValue: '正在导入旧版数据…' })}
        hint={
          importProgress
            ? t('version_migration.importing_item', {
                name: importProgress,
                defaultValue: `正在处理：${importProgress}`
              })
            : t('version_migration.importing_hint', { defaultValue: '请勿关闭应用' })
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
        <View
          style={[
            styles.card,
            { backgroundColor: colors.bgSurface, borderRadius: tokens.radius.lg }
          ]}
        >
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
          {allFilesAccessGranted === false ? (
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
              {t('version_migration.choose_legacy_directory', { defaultValue: '选择旧版目录' })}
            </Button>
            {customLegacySourceRoot ? (
              <Button
                variant="outline"
                className="flex-1"
                style={{ backgroundColor: colors.bgSurface }}
                onPress={() => void handleClearCustomLegacyDirectory()}
                disabled={scanning}
              >
                {t('version_migration.clear_custom_legacy_directory', {
                  defaultValue: '恢复自动检测'
                })}
              </Button>
            ) : null}
          </View>

          {scanResult ? (
            <>
              {legacySourceKindKey ? (
                <Text style={[styles.hint, { color: colors.textTertiary }]}>
                  {t(legacySourceKindKey)}
                </Text>
              ) : null}
              <Text style={[styles.mono, { color: colors.textTertiary }]} selectable>
                {t('version_migration.source_path', {
                  path: scanResult.sourceDisplayPath,
                  defaultValue: '旧版目录：{{path}}'
                })}
              </Text>
            </>
          ) : null}

          <Button
            variant="outline"
            className="w-full"
            style={{ backgroundColor: colors.bgSurface, marginTop: sharedTokens.spacing.xs }}
            onPress={() => void refreshScan()}
            disabled={!pageReady || scanning}
          >
            {scanning
              ? t('version_migration.scanning', { defaultValue: '正在扫描…' })
              : t('version_migration.rescan', { defaultValue: '重新扫描' })}
          </Button>
        </View>

        {showSectionScanSpinner ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textSecondary }}>
              {t('version_migration.scanning', { defaultValue: '正在扫描…' })}
            </Text>
          </View>
        ) : null}

        {pageReady && !scanning && dbUnavailable ? (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.bgSurface, borderRadius: tokens.radius.lg }
            ]}
          >
            <Text
              style={{ color: colors.textSecondary, fontSize: mobileTypography.secondary.fontSize }}
            >
              {t('version_migration.db_not_ready', {
                defaultValue: '数据库尚未就绪，请稍候后重新扫描。'
              })}
            </Text>
          </View>
        ) : null}

        {pageReady && !scanning && !dbUnavailable && !scanResult ? (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.bgSurface, borderRadius: tokens.radius.lg }
            ]}
          >
            <Text
              style={{ color: colors.textSecondary, fontSize: mobileTypography.secondary.fontSize }}
            >
              {t(
                'version_migration.no_legacy_data',
                '未检测到可迁移的旧版数据。若您刚升级，请确认旧版目录仍可访问，或手动选择旧版 Flutter 数据目录。'
              )}
            </Text>
          </View>
        ) : null}

        {globalSections.length > 0 ? (
          <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>
            {t('version_migration.global_group_title', { defaultValue: '全局数据' })}
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
            importing={importBusy}
            onImport={() => void handleImportSection(section.sectionId)}
          />
        ))}

        {workspaceSections.length > 0 ? (
          <View style={styles.workspaceHeader}>
            <Text style={[styles.groupTitle, { color: colors.textSecondary, marginBottom: 0 }]}>
              {t('version_migration.workspace_group_title', { defaultValue: '工作空间' })}
            </Text>
            {importableWorkspaces.length > 1 ? (
              <Button
                variant="outline"
                style={{ backgroundColor: colors.bgSurface }}
                onPress={() => void handleImportAllWorkspaces()}
                disabled={importBusy}
              >
                {t('version_migration.import_all_workspaces', {
                  defaultValue: '导入全部工作空间'
                })}
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
              importing={importBusy}
              onImport={() => void handleImportSection(workspace.sectionId)}
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
    padding: sharedTokens.spacing.mdTight,
    gap: sharedTokens.spacing.mdTight,
    paddingBottom: sharedTokens.spacing.xl
  },
  card: {
    padding: sharedTokens.spacing.mdSnug,
    gap: sharedTokens.spacing.sm
  },
  desc: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20
  },
  hint: {
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 18
  },
  mono: {
    fontSize: mobileTypography.caption.fontSize,
    fontFamily: 'monospace',
    lineHeight: 18
  },
  sourceActions: {
    flexDirection: 'row',
    gap: sharedTokens.spacing.sm,
    flexWrap: 'wrap'
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.md,
    justifyContent: 'center'
  },
  groupTitle: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    marginBottom: -4,
    marginTop: sharedTokens.spacing.xs
  },
  workspaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.sm,
    marginTop: sharedTokens.spacing.xs
  }
})
