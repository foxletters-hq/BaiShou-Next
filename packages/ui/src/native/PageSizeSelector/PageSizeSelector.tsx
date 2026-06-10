import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  type ViewProps
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { pageSizeSelectorStyles as styles } from './page-size-selector.styles'

export interface PageSizeSelectorProps extends ViewProps {
  value: number
  options: number[]
  onChange: (size: number) => void
  /** 单位标签，如「条/页」（对齐 Desktop PageSizeSelector） */
  label?: string
}

export const PageSizeSelector: React.FC<PageSizeSelectorProps> = ({
  value,
  options,
  onChange,
  label,
  style,
  ...props
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const resolvedLabel = label ?? t('common.per_page_suffix', '/ page')
  const [open, setOpen] = useState(false)

  const handleSelect = (size: number) => {
    onChange(size)
    setOpen(false)
  }

  return (
    <View style={[styles.wrapper, style]} {...props}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setOpen(true)}
        style={[
          styles.triggerBtn,
          {
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle
          }
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('diary.per_page', '条/页')}
      >
        <Text style={[styles.pageSizeValue, { color: colors.primary }]}>{value}</Text>
        <Text style={[styles.pageSizeUnit, { color: colors.textTertiary }]}>{resolvedLabel}</Text>
        <MaterialIcons
          name="view-list"
          size={14}
          color={colors.textTertiary}
          style={{ opacity: 0.7 }}
        />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgOverlay }]}
            onPress={() => setOpen(false)}
          />
          <View
            style={[
              styles.dropdownPanel,
              {
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle,
                shadowColor: '#000'
              }
            ]}
          >
            <View style={styles.optionsGrid}>
              {options.map((size) => {
                const selected = size === value
                return (
                  <TouchableOpacity
                    key={size}
                    activeOpacity={0.7}
                    onPress={() => handleSelect(size)}
                    style={[
                      styles.optionBtn,
                      selected
                        ? {
                            backgroundColor: colors.primary,
                            shadowColor: colors.primary,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.25,
                            shadowRadius: 6,
                            elevation: 3
                          }
                        : { backgroundColor: 'transparent' }
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionBtnText,
                        selected ? styles.optionBtnTextSelected : null,
                        { color: selected ? colors.onPrimary : colors.textPrimary }
                      ]}
                    >
                      {size}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.textTertiary }]}>
                {resolvedLabel}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}
