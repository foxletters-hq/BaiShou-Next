import React, { useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { useTranslation } from 'react-i18next'
import { formatLocalDate, isValidUserBirthday } from '@baishou/shared'
import { mobileTypography, sharedTokens } from '../../theme/tokens'
import { useNativeTheme } from '../theme'
import { DatePickerFloatingModal } from './DatePickerFloatingModal'

export interface BirthdayPickerFieldProps {
  /** 当前生日，格式为 YYYY-MM-DD 或空字符串 / null */
  value?: string | null
  /** 生日变更回调 */
  onChange: (value: string) => void
  /** 字段标签，例如 "生日" 或 "你的生日" */
  label?: string
  /** 是否必填（在 label 旁显示红星） */
  required?: boolean
  /** 占位文案，默认 "选择你的生日（选填）" */
  placeholder?: string
  /** 错误文案，存在时边框变红并展示提示 */
  error?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否允许清除已选生日，默认为 true */
  clearable?: boolean
  /** 选择器弹窗标题，默认展示 "生日" */
  modalTitle?: string
  /** 最小可选日期，默认 1900-01-01 */
  minDate?: Date
  /** 最大可选日期，默认今天 */
  maxDate?: Date
  /** 未选择时，选择器弹窗默认定位的日期，默认为当天 */
  defaultPickerDate?: Date
  /** 外层容器样式 */
  containerStyle?: StyleProp<ViewStyle>
  /** 触发框样式 */
  triggerStyle?: StyleProp<ViewStyle>
  /** 无障碍标签 */
  accessibilityLabel?: string
}

export const BirthdayPickerField: React.FC<BirthdayPickerFieldProps> = ({
  value,
  onChange,
  label,
  required = false,
  placeholder,
  error,
  disabled = false,
  clearable = true,
  modalTitle,
  minDate,
  maxDate,
  defaultPickerDate,
  containerStyle,
  triggerStyle,
  accessibilityLabel
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [pickerOpen, setPickerOpen] = useState(false)

  const normalizedValue = typeof value === 'string' ? value.trim() : ''
  const hasValidValue = useMemo(() => isValidUserBirthday(normalizedValue), [normalizedValue])

  const birthdayDate = useMemo(() => {
    if (hasValidValue) {
      const [y, m, d] = normalizedValue.split('-').map(Number)
      return new Date(y, m - 1, d)
    }
    return defaultPickerDate ?? new Date()
  }, [hasValidValue, normalizedValue, defaultPickerDate])

  const displayLabel = useMemo(() => {
    if (!hasValidValue) {
      return (
        placeholder ??
        t(
          'profile.birthday_placeholder',
          t('onboarding.birthday_placeholder', '选择你的生日（选填）')
        )
      )
    }
    const [y, m, d] = normalizedValue.split('-').map(Number)
    return t('graph.awaken_birthday_value', '{{year}}年{{month}}月{{day}}日', {
      year: y,
      month: m,
      day: d
    })
  }, [hasValidValue, normalizedValue, placeholder, t])

  const resolvedMinDate = useMemo(() => minDate ?? new Date(1900, 0, 1), [minDate])
  const resolvedMaxDate = useMemo(() => maxDate ?? new Date(), [maxDate])
  const resolvedModalTitle = modalTitle ?? label ?? t('profile.birthday_label', '生日')

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
          {required ? <Text style={[styles.requiredMark, { color: colors.error }]}>*</Text> : null}
        </View>
      ) : null}

      <Pressable
        disabled={disabled}
        onPress={() => setPickerOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            borderColor: error ? colors.error : colors.borderControl,
            backgroundColor: colors.bgSurface,
            opacity: disabled ? 0.55 : pressed ? 0.85 : 1
          },
          triggerStyle
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label || placeholder || 'Birthday'}
      >
        <Text
          style={[
            styles.fieldText,
            { color: hasValidValue ? colors.textPrimary : colors.textTertiary }
          ]}
          numberOfLines={1}
        >
          {displayLabel}
        </Text>

        <View style={styles.trailing}>
          {clearable && hasValidValue && !disabled ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation()
                onChange('')
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.clear', '清除')}
            >
              <Text style={[styles.clearIcon, { color: colors.textTertiary }]}>✕</Text>
            </Pressable>
          ) : null}
          <Text style={[styles.chevronIcon, { color: colors.textTertiary }]}>▼</Text>
        </View>
      </Pressable>

      {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

      <DatePickerFloatingModal
        visible={pickerOpen}
        value={birthdayDate}
        minDate={resolvedMinDate}
        maxDate={resolvedMaxDate}
        title={resolvedModalTitle}
        onClose={() => setPickerOpen(false)}
        onConfirm={(date) => {
          onChange(formatLocalDate(date))
          setPickerOpen(false)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: sharedTokens.spacing.xs
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xxs
  },
  label: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  requiredMark: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  trigger: {
    minHeight: 44,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.sm
  },
  fieldText: {
    flex: 1,
    fontSize: mobileTypography.body.fontSize
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  clearIcon: {
    fontSize: mobileTypography.secondary.fontSize
  },
  chevronIcon: {
    fontSize: mobileTypography.caption.fontSize
  },
  errorText: {
    fontSize: mobileTypography.caption.fontSize,
    marginTop: 2
  }
})
