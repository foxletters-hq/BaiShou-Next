import { useTranslation } from 'react-i18next'
import React from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import type { SharedMemoryCopyPreview } from '@baishou/shared'
import { useNativeTheme } from '../../native/theme'
import { formatCompactTokenCount } from '../../shared/token-usage-display'
import { buildSharedMemoryPreviewChips } from '../../shared/shared-memory-preview.util'

export function SharedMemoryCopyPreviewPanel({
  preview,
  loading
}: {
  preview?: SharedMemoryCopyPreview | null
  loading?: boolean
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  if (loading && !preview) {
    return (
      <View
        style={[
          previewStyles.panel,
          previewStyles.panelLoading,
          { backgroundColor: colors.bgSurfaceLowest, borderColor: colors.borderMuted }
        ]}
      >
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[previewStyles.loadingText, { color: colors.textSecondary }]}>
          {t('summary.copy_preview_loading', '正在统计可复制内容…')}
        </Text>
      </View>
    )
  }

  if (!preview) return null

  const chips = buildSharedMemoryPreviewChips(preview, t)

  return (
    <View
      style={[
        previewStyles.panel,
        { backgroundColor: colors.bgSurfaceLowest, borderColor: colors.borderMuted }
      ]}
    >
      <View style={previewStyles.titleRow}>
        <Text style={[previewStyles.title, { color: colors.textPrimary }]}>
          {t('summary.copy_preview_title', '复制将包含')}
        </Text>
        {loading ? <ActivityIndicator size={12} color={colors.textTertiary} /> : null}
      </View>
      {preview.total === 0 ? (
        <Text style={[previewStyles.emptyText, { color: colors.textSecondary }]}>
          {t('summary.copy_preview_empty', '当前回溯范围内暂无可复制内容')}
        </Text>
      ) : (
        <>
          <View style={previewStyles.chips}>
            {chips.map((item) => (
              <View
                key={item.key}
                style={[previewStyles.chip, { backgroundColor: colors.primaryLight }]}
              >
                <Text style={[previewStyles.chipText, { color: colors.primary }]}>
                  {item.label} {item.count}
                  {t('summary.copy_preview_unit', '篇')}
                </Text>
              </View>
            ))}
          </View>
          <Text style={[previewStyles.total, { color: colors.textTertiary }]}>
            {t('summary.copy_preview_total', '共 {{count}} 项', { count: preview.total })}
          </Text>
          <Text style={[previewStyles.size, { color: colors.textTertiary }]}>
            {t('summary.copy_preview_estimated_size', '约 {{chars}} 字 · 约 {{tokens}} tokens', {
              chars: preview.estimatedChars.toLocaleString(),
              tokens: formatCompactTokenCount(preview.estimatedTokens)
            })}
          </Text>
        </>
      )}
    </View>
  )
}

const previewStyles = StyleSheet.create({
  panel: {
    marginTop: 16,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8
  },
  panelLoading: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  title: {
    fontSize: 12,
    fontWeight: '600'
  },
  loadingText: {
    fontSize: 12
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600'
  },
  total: {
    fontSize: 11
  },
  size: {
    fontSize: 11
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 18
  }
})
