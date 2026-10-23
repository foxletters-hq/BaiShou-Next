import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  ScrollView
} from 'react-native'
import { Button, Input, modalActionsStyle, NativeSlider } from '@baishou/ui/native'
import { Archive } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import type { useNativeTheme } from '@baishou/ui/native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

type ThemeColors = ReturnType<typeof useNativeTheme>['colors']

const COUNT_CHIPS = [1, 2, 3, 5, 10, 15, -1] as const

export interface DataSyncCountModalProps {
  visible: boolean
  activeTab: 'cloud' | 'snapshot' | 'local'
  tempCount: number
  noLimitLabel: string
  colors: ThemeColors
  maxModalWidth: number
  onChangeCount: (count: number) => void
  onConfirm: () => void
  onClose: () => void
}

export const DataSyncCountModal: React.FC<DataSyncCountModalProps> = ({
  visible,
  activeTab,
  tempCount,
  noLimitLabel,
  colors,
  maxModalWidth,
  onChangeCount,
  onConfirm,
  onClose
}) => {
  const { t } = useTranslation()
  const isSnapshot = activeTab === 'snapshot'

  const displayValue = tempCount === -1 ? noLimitLabel : String(tempCount)

  const handleInputChange = (text: string) => {
    const val = text.trim()
    if (
      val === '' ||
      val === noLimitLabel ||
      val === t('data_sync.no_limit', '不限制数量') ||
      val === t('auto.apps.mobile.src.screens.DataSyncCountModal.L55', '不限制') ||
      val === '∞' ||
      val === '-1'
    ) {
      onChangeCount(-1)
      return
    }
    const num = parseInt(val, 10)
    if (!Number.isNaN(num)) {
      onChangeCount(Math.min(100, Math.max(1, num)))
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.bgOverlay }]} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle,
              maxWidth: maxModalWidth,
              alignSelf: 'center',
              width: '92%'
            }
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <View style={[styles.headerIconWrapper, { backgroundColor: colors.bgSurfaceNormal }]}>
              <Archive size={18} color={colors.primary} strokeWidth={2} />
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {isSnapshot
                ? t('data_sync.max_snapshot_title', '快照上限设置')
                : t('data_sync.max_backup_title', '备份上限设置')}
            </Text>
          </View>

          <Text style={[styles.desc, { color: colors.textSecondary }]}>
            {isSnapshot
              ? t(
                  'data_sync.max_snapshot_desc',
                  '超过上限后，自动生成新快照时将清理最早的历史快照。'
                )
              : t('data_sync.max_backup_desc', '超过上限后，同步备份时将自动删除最早的备份文件。')}
          </Text>

          <View
            style={[
              styles.valueRow,
              { backgroundColor: colors.bgSurfaceNormal, borderColor: colors.borderControl }
            ]}
          >
            <Text style={[styles.valueLabel, { color: colors.textPrimary }]}>
              {t('data_sync.limit_count_label', '保留数量')}
            </Text>
            <View style={styles.inputWrapper}>
              <Input
                containerStyle={styles.inputContainer}
                style={[styles.numberInput, { color: colors.textPrimary }]}
                value={displayValue}
                onChangeText={handleInputChange}
                onBlur={() => {
                  if (tempCount !== -1) {
                    onChangeCount(Math.min(100, Math.max(1, tempCount)))
                  }
                }}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View style={styles.sliderContainer}>
            <NativeSlider
              value={tempCount === -1 ? 50 : tempCount}
              minValue={1}
              maxValue={50}
              step={1}
              onChange={(v) => onChangeCount(v)}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            {COUNT_CHIPS.map((val) => {
              const active = tempCount === val
              return (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.primary : colors.bgSurfaceNormal,
                      borderColor: active ? colors.primary : colors.borderControl
                    }
                  ]}
                  onPress={() => onChangeCount(val)}
                >
                  <Text
                    style={{
                      color: active ? colors.textOnPrimary : colors.textSecondary,
                      fontSize: mobileTypography.caption.fontSize,
                      fontWeight: '500'
                    }}
                  >
                    {val === -1
                      ? t('data_sync.no_limit', '不限制数量')
                      : t('data_sync.count_unit_value', '$count 个').replace('$count', String(val))}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          <View style={modalActionsStyle}>
            <Button size="sm" variant="outlined" onPress={onClose}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" onPress={onConfirm}>
              {t('common.confirm')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: sharedTokens.spacing.md
  },
  sheet: {
    borderRadius: sharedTokens.radius.lg,
    borderWidth: 1,
    padding: sharedTokens.spacing.mdPlus
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    marginBottom: sharedTokens.spacing.xsPlus
  },
  headerIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: sharedTokens.radius.control,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    flex: 1,
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600'
  },
  desc: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20,
    marginBottom: sharedTokens.spacing.md
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.xsPlus,
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1,
    marginBottom: sharedTokens.spacing.md
  },
  valueLabel: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '500'
  },
  inputWrapper: {
    width: 90
  },
  inputContainer: {
    marginBottom: 0
  },
  numberInput: {
    textAlign: 'center',
    fontWeight: '600',
    fontSize: mobileTypography.primary.fontSize
  },
  sliderContainer: {
    marginBottom: sharedTokens.spacing.xs
  },
  chipsRow: {
    marginTop: sharedTokens.spacing.xs,
    marginBottom: sharedTokens.spacing.mdPlus
  },
  chip: {
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.xsPlus,
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1,
    marginRight: sharedTokens.spacing.sm
  }
})
