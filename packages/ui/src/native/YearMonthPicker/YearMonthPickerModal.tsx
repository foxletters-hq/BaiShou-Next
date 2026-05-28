import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  useWindowDimensions
} from 'react-native'
import { useTranslation } from 'react-i18next'
import type { useNativeTheme } from '../theme'
import type { YearMonthPickerProps } from './year-month-picker.types'
import { MONTH_I18N_KEYS, getPickerYearRange } from './year-month-picker.utils'
import { yearMonthPickerStyles as styles } from './year-month-picker.styles'

export function YearMonthPickerModal({
  isOpen,
  onClose,
  selectedMonth,
  onChange,
  colors
}: {
  isOpen: boolean
  onClose: () => void
  selectedMonth: Date | null
  onChange: YearMonthPickerProps['onChange']
  colors: ReturnType<typeof useNativeTheme>['colors']
}) {
  const { t } = useTranslation()
  const { width: screenWidth } = useWindowDimensions()
  const modalWidth = Math.min(screenWidth - 32, 400)

  const years = React.useMemo(() => getPickerYearRange(), [])
  const [viewYear, setViewYear] = useState(
    () => selectedMonth?.getFullYear() ?? new Date().getFullYear()
  )
  const yearScrollViewRef = React.useRef<ScrollView>(null)

  const currentPhysicalYear = new Date().getFullYear()
  const currentPhysicalMonth = new Date().getMonth() + 1

  useEffect(() => {
    if (isOpen && selectedMonth) {
      setViewYear(selectedMonth.getFullYear())
    }
  }, [isOpen, selectedMonth])

  useEffect(() => {
    if (isOpen && yearScrollViewRef.current) {
      const yearIndex = years.indexOf(viewYear)
      if (yearIndex >= 0) {
        setTimeout(() => {
          yearScrollViewRef.current?.scrollTo({
            y: yearIndex * 44,
            animated: false
          })
        }, 100)
      }
    }
  }, [isOpen, viewYear, years])

  const handleSelectMonth = useCallback(
    (m: number) => {
      onChange(new Date(viewYear, m - 1, 1))
      setTimeout(() => onClose(), 220)
    },
    [viewYear, onChange, onClose]
  )

  const handleClear = useCallback(() => {
    onChange(null)
    onClose()
  }, [onChange, onClose])

  const handleThisMonth = useCallback(() => {
    const now = new Date()
    onChange(new Date(now.getFullYear(), now.getMonth(), 1))
    onClose()
  }, [onChange, onClose])

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.overlay, { backgroundColor: colors.bgOverlay }]}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.modalContent,
            {
              width: modalWidth,
              backgroundColor: colors.bgSurface
            }
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {t('diary.select_month')}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={[styles.closeBtn, { color: colors.textSecondary }]}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.pickerContainer}>
            <View style={[styles.yearPane, { borderRightColor: colors.borderSubtle }]}>
              <ScrollView
                ref={yearScrollViewRef}
                style={styles.yearList}
                showsVerticalScrollIndicator={false}
              >
                {years.map((y) => {
                  const isActive = viewYear === y
                  const isSelectedYear = selectedMonth?.getFullYear() === y
                  return (
                    <Pressable
                      key={y}
                      style={[
                        styles.yearItem,
                        isActive && { backgroundColor: colors.primaryLight },
                        isSelectedYear &&
                          !isActive && { backgroundColor: colors.bgSurfaceHighest }
                      ]}
                      onPress={() => setViewYear(y)}
                    >
                      <Text
                        style={[
                          styles.yearText,
                          {
                            color: isActive ? colors.primary : colors.textPrimary,
                            fontWeight: isActive ? '700' : '400'
                          }
                        ]}
                      >
                        {y}
                      </Text>
                    </Pressable>
                  )
                })}
              </ScrollView>
            </View>

            <View style={styles.monthPane}>
              <View style={styles.monthGrid}>
                {MONTH_I18N_KEYS.map((monthKey, index) => {
                  const m = index + 1
                  const isSelected =
                    selectedMonth?.getFullYear() === viewYear &&
                    selectedMonth?.getMonth() + 1 === m
                  const isCurrentMonth =
                    currentPhysicalYear === viewYear && currentPhysicalMonth === m
                  return (
                    <Pressable
                      key={m}
                      style={[
                        styles.monthItem,
                        {
                          backgroundColor: isSelected
                            ? colors.primary
                            : isCurrentMonth
                              ? colors.primaryLight
                              : colors.bgSurfaceHighest,
                          borderColor:
                            isCurrentMonth && !isSelected ? colors.primary : colors.borderSubtle
                        }
                      ]}
                      onPress={() => handleSelectMonth(m)}
                    >
                      <Text
                        style={[
                          styles.monthText,
                          {
                            color: isSelected ? colors.textOnPrimary : colors.textPrimary
                          }
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                      >
                        {t(`diary.${monthKey}`)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          </View>

          <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
            <Pressable
              style={[styles.footerBtn, { backgroundColor: colors.bgSurfaceHighest }]}
              onPress={handleClear}
            >
              <Text
                style={[styles.footerBtnText, { color: colors.textSecondary, textAlign: 'center' }]}
                numberOfLines={2}
              >
                {t('diary.all_diaries')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.footerBtn, { backgroundColor: colors.primary }]}
              onPress={handleThisMonth}
            >
              <Text
                style={[styles.footerBtnText, { color: colors.textOnPrimary, textAlign: 'center' }]}
                numberOfLines={2}
              >
                {t('common.this_month')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
