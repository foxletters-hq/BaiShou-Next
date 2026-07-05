import { useTranslation } from 'react-i18next'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform
} from 'react-native'
import { Copy, Quote, TextQuote } from 'lucide-react-native'
import type { SharedMemoryCopyPreview } from '@baishou/shared'
import { DesktopStyleSlider } from './DesktopStyleSlider'
import { useNativeTheme } from '../../native/theme'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import { Input } from '../Input/Input'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { formatCompactTokenCount } from '../../shared/token-usage-display'

const SLIDER_MIN = 1
const SLIDER_BASE_MAX = 60

interface DashboardSharedMemoryCardProps {
  lookbackMonths: number
  onMonthsChanged: (val: number) => void
  onCopyContext: () => void | Promise<void>
  copyPreview?: SharedMemoryCopyPreview | null
  copyPreviewLoading?: boolean
  copyPrefix?: string
  onCopyPrefixChange?: (prefix: string) => void
}

function CopyPrefixModal({
  visible,
  initialValue,
  onCancel,
  onConfirm
}: {
  visible: boolean
  initialValue: string
  onCancel: () => void
  onConfirm: (value: string) => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    if (visible) setValue(initialValue)
  }, [visible, initialValue])

  if (!visible) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={[prefixModalStyles.overlay, { backgroundColor: colors.overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View
          style={[
            prefixModalStyles.card,
            {
              backgroundColor: colors.bgSurface,
              borderRadius: tokens.radius.xl,
              padding: tokens.spacing.lg
            }
          ]}
        >
          <Text style={[prefixModalStyles.title, { color: colors.textPrimary }]}>
            {t('summary.copy_prefix_label', '拷贝前缀')}
          </Text>
          <Text style={[prefixModalStyles.message, { color: colors.textSecondary }]}>
            {t(
              'summary.copy_prefix_hint',
              '会自动附加在拷贝内容的最前方（例如：Hi，这是我的回忆...）'
            )}
          </Text>
          <Input
            value={value}
            onChangeText={setValue}
            multiline
            textarea
            autoFocus
            containerStyle={{ marginBottom: 16 }}
            style={{ minHeight: 100 }}
          />
          <View style={prefixModalStyles.actions}>
            <Pressable onPress={onCancel} style={prefixModalStyles.actionBtn}>
              <Text style={{ color: colors.textSecondary }}>{t('common.cancel', '取消')}</Text>
            </Pressable>
            <Pressable onPress={() => onConfirm(value)} style={prefixModalStyles.actionBtn}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                {t('common.confirm', '确定')}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function SharedMemoryCopyPreviewPanel({
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

  const chips: { key: string; label: string; count: number }[] = [
    { key: 'diary', label: t('summary.copy_preview_diary', '日记'), count: preview.diary },
    { key: 'yearly', label: t('summary.copy_preview_yearly', '年总结'), count: preview.yearly },
    {
      key: 'quarterly',
      label: t('summary.copy_preview_quarterly', '季度总结'),
      count: preview.quarterly
    },
    { key: 'monthly', label: t('summary.copy_preview_monthly', '月总结'), count: preview.monthly },
    { key: 'weekly', label: t('summary.copy_preview_weekly', '周总结'), count: preview.weekly }
  ].filter((item) => item.count > 0)

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

/** 滑块 + 数字输入：拖动预览仅在本组件内更新，避免牵动整张卡片重渲染 */
function LookbackMonthsField({
  lookbackMonths,
  label,
  onMonthsChanged
}: {
  lookbackMonths: number
  label: string
  onMonthsChanged: (val: number) => void
}) {
  const { colors } = useNativeTheme()
  const [displayMonths, setDisplayMonths] = useState(lookbackMonths)
  const numberInputRef = useRef<TextInput>(null)
  const editingRef = useRef(false)

  const syncNumberDisplay = useCallback((next: number) => {
    numberInputRef.current?.setNativeProps({ text: String(next) })
  }, [])

  useEffect(() => {
    setDisplayMonths((prev) => (prev === lookbackMonths ? prev : lookbackMonths))
    if (!editingRef.current) {
      syncNumberDisplay(lookbackMonths)
    }
  }, [lookbackMonths, syncNumberDisplay])

  const commitMonths = useCallback(
    (raw: number) => {
      const clamped = Math.max(SLIDER_MIN, Math.round(raw))
      setDisplayMonths(clamped)
      syncNumberDisplay(clamped)
      if (clamped !== lookbackMonths) {
        onMonthsChanged(clamped)
      }
    },
    [lookbackMonths, onMonthsChanged, syncNumberDisplay]
  )

  const handleSliderPreview = useCallback(
    (next: number) => {
      if (editingRef.current) return
      syncNumberDisplay(next)
    },
    [syncNumberDisplay]
  )

  const sliderMax = Math.max(SLIDER_BASE_MAX, lookbackMonths)

  return (
    <View style={fieldStyles.controls}>
      <View style={fieldStyles.labelRow}>
        <Text style={[fieldStyles.label, { color: colors.textPrimary }]}>{label}</Text>
        <TextInput
          ref={numberInputRef}
          style={[
            fieldStyles.numberInput,
            {
              color: colors.textPrimary,
              borderColor: colors.borderMuted,
              backgroundColor: colors.bgSurface
            }
          ]}
          defaultValue={String(displayMonths)}
          keyboardType="number-pad"
          maxLength={4}
          selectTextOnFocus
          onFocus={() => {
            editingRef.current = true
          }}
          onChangeText={(text) => {
            const digits = text.replace(/\D/g, '')
            if (digits.length === 0) return
            const n = parseInt(digits, 10)
            if (!Number.isNaN(n)) {
              setDisplayMonths(Math.max(SLIDER_MIN, n))
            }
          }}
          onEndEditing={() => {
            editingRef.current = false
            commitMonths(displayMonths)
          }}
          onBlur={() => {
            editingRef.current = false
            commitMonths(displayMonths)
          }}
        />
      </View>
      <View style={fieldStyles.sliderWrap}>
        <DesktopStyleSlider
          value={lookbackMonths}
          minimumValue={SLIDER_MIN}
          maximumValue={sliderMax}
          step={1}
          onPreviewChange={handleSliderPreview}
          onValueChange={commitMonths}
        />
      </View>
    </View>
  )
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
            <TextQuote
              size={16}
              color={colors.textSecondary}
              strokeWidth={DEFAULT_STROKE_WIDTH}
            />
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
          <ActivityIndicator size="small" color="#ffffff" style={styles.btnIcon} />
        ) : (
          <Copy size={16} color="#ffffff" strokeWidth={DEFAULT_STROKE_WIDTH} style={styles.btnIcon} />
        )}
        <Text style={styles.btnText}>{t('summary.copy_memories')}</Text>
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

const prefixModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center'
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4
  }
})

const fieldStyles = StyleSheet.create({
  controls: {
    gap: 8
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1
  },
  numberInput: {
    width: 64,
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 4,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    borderWidth: 1,
    borderRadius: 10
  },
  sliderWrap: {
    width: '100%',
    justifyContent: 'center',
    minHeight: 44
  }
})

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
    fontWeight: '800',
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
    fontSize: 14,
    color: '#ffffff'
  }
})

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
    fontWeight: '700'
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
