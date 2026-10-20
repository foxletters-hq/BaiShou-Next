import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

export type VersionMigrationSectionCardProps = {
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
}

/** 版本迁移的单个数据板块卡片 */
export function VersionMigrationSectionCard({
  title,
  meta,
  warnings,
  previewItems,
  previewFormat,
  failureSamples,
  importStatus,
  available,
  importing,
  onImport
}: VersionMigrationSectionCardProps) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  return (
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: colors.bgSurface, borderRadius: tokens.radius.lg }
      ]}
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
            {t('version_migration.failure_samples_title', { defaultValue: '部分条目导入失败：' })}
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
            ? t('version_migration.status_success', { defaultValue: '已导入' })
            : importStatus === 'failed'
              ? t('version_migration.status_failed', { defaultValue: '导入失败' })
              : importStatus === 'importing'
                ? t('version_migration.status_importing', { defaultValue: '导入中…' })
                : available
                  ? t('version_migration.status_ready', { defaultValue: '可导入' })
                  : t('version_migration.status_unavailable', { defaultValue: '无数据' })}
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
          <Text style={[styles.importBtnText, { color: colors.textOnPrimary }]}>
            {t('version_migration.import_action', { defaultValue: '导入' })}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sectionCard: {
    padding: sharedTokens.spacing.mdSnug,
    gap: sharedTokens.spacing.sm
  },
  sectionHeader: {
    gap: sharedTokens.spacing.xs
  },
  sectionTitle: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  },
  sectionMeta: {
    fontSize: mobileTypography.secondary.fontSize
  },
  previewList: {
    gap: sharedTokens.spacing.xxs
  },
  previewItem: {
    fontSize: mobileTypography.secondary.fontSize
  },
  failureTitle: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600',
    marginTop: sharedTokens.spacing.xs
  },
  warning: {
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 18
  },
  sectionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: sharedTokens.spacing.xs
  },
  statusText: {
    fontSize: mobileTypography.caption.fontSize,
    flex: 1,
    marginRight: sharedTokens.spacing.mdTight
  },
  importBtn: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm
  },
  importBtnText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  }
})
