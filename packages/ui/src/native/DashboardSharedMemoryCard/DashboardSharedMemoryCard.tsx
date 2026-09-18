import { useTranslation } from 'react-i18next'
import React, { useCallback, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Copy, Quote, TextQuote } from 'lucide-react-native'
import type { SharedMemoryCopyPreview } from '@baishou/shared'
import { CopyPrefixModal } from './CopyPrefixModal'
import { SharedMemoryCopyPreviewPanel } from './SharedMemoryCopyPreviewPanel'
import { LookbackMonthsField } from './LookbackMonthsField'
import { useNativeTheme } from '../../native/theme'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'

interface DashboardSharedMemoryCardProps {
  lookbackMonths: number
  onMonthsChanged: (val: number) => void
  onCopyContext: () => void | Promise<void>
  copyPreview?: SharedMemoryCopyPreview | null
  copyPreviewLoading?: boolean
  copyPrefix?: string
  onCopyPrefixChange?: (prefix: string) => void
}

export const DashboardSharedMemoryCard: React.FC<DashboardSharedMemoryCardProps> = ({
  lookbackMonths,
  onMonthsChanged,
  onCopyContext,
  copyPreview,
  copyPreviewLoading,
  copyPrefix = '',
  onCopyPrefixChange
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const cardBorder = colors.borderMuted
  const [copying, setCopying] = useState(false)
  const [prefixModalVisible, setPrefixModalVisible] = useState(false)

  const handleCopyPress = useCallback(async () => {
    if (copying) return
    setCopying(true)
    try {
      await onCopyContext()
    } finally {
      setCopying(false)
    }
  }, [copying, onCopyContext])

  return (
    <View style={[styles.card, { backgroundColor: colors.bgSurface, borderColor: cardBorder }]}>
      <View style={styles.header}>
        <View style={styles.headerMain}>
          <Quote
            size={20}
            color={colors.primary}
            strokeWidth={DEFAULT_STROKE_WIDTH}
            style={styles.headerIcon}
          />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {t('summary.shared_memory')}
          </Text>
          <View style={styles.helpWrap}>
            <HelpTooltip
              content={t(
                'summary.shared_memory_tooltip',
                '共同回忆统计展示您在设定时间周期内的核心足迹与情感波动数据。系统通过级联折叠算法在后台自动整合历史快照数据，去除重复啰嗦内容，将海量原始流水账压缩为符合 LLM 极窄上下文容量的高浓度叙事，方便 AI 快速理解您的近期现状。'
              )}
              size={16}
            />
          </View>
        </View>
        {onCopyPrefixChange ? (
          <TouchableOpacity
            activeOpacity={0.75}
            style={[styles.prefixBtn, { backgroundColor: colors.bgSurfaceLowest }]}
            onPress={() => setPrefixModalVisible(true)}
            accessibilityLabel={t('summary.copy_prefix_label', '拷贝前缀')}
          >
            <TextQuote size={16} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
          </TouchableOpacity>
        ) : null}
      </View>

      <LookbackMonthsField
        lookbackMonths={lookbackMonths}
        label={t('summary.lookback_label')}
        onMonthsChanged={onMonthsChanged}
      />

      <SharedMemoryCopyPreviewPanel preview={copyPreview} loading={copyPreviewLoading} />

      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.btn, { backgroundColor: colors.primary, opacity: copying ? 0.85 : 1 }]}
        onPress={() => void handleCopyPress()}
        disabled={copying}
      >
        {copying ? (
          <ActivityIndicator size="small" color={colors.textOnPrimary} style={styles.btnIcon} />
        ) : (
          <Copy
            size={16}
            color={colors.textOnPrimary}
            strokeWidth={DEFAULT_STROKE_WIDTH}
            style={styles.btnIcon}
          />
        )}
        <Text style={[styles.btnText, { color: colors.textOnPrimary }]}>
          {t('summary.copy_memories')}
        </Text>
      </TouchableOpacity>

      {onCopyPrefixChange ? (
        <CopyPrefixModal
          visible={prefixModalVisible}
          initialValue={copyPrefix}
          onCancel={() => setPrefixModalVisible(false)}
          onConfirm={(value) => {
            onCopyPrefixChange(value)
            setPrefixModalVisible(false)
          }}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'solid'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0
  },
  headerIcon: {
    marginRight: 8
  },
  headerTitle: {
    fontWeight: '600',
    fontSize: 16
  },
  helpWrap: {
    marginLeft: 8
  },
  prefixBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  btn: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnIcon: {
    marginRight: 6
  },
  btnText: {
    fontWeight: '600',
    fontSize: 14
  }
})
