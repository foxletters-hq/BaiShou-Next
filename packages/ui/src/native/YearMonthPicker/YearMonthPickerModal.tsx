import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native'
import type { useNativeTheme } from '../theme'
import type { YearMonthPickerProps } from './year-month-picker.types'
import { MONTH_NAMES, getPickerYearRange } from './year-month-picker.utils'
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
      onClose()
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
      <TouchableOpacity
        style={[styles.overlay, { backgroundColor: colors.bgApp + 'CC' }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.modalContent, { backgroundColor: colors.bgSurface }]}>
            <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>选择年月</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={[styles.closeBtn, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
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
                      <TouchableOpacity
                        key={y}
                        style={[
                          styles.yearItem,
                          isActive && { backgroundColor: colors.primary + '20' },
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
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              </View>

              <View style={styles.monthPane}>
                <View style={styles.monthGrid}>
                  {MONTH_NAMES.map((name, index) => {
                    const m = index + 1
                    const isSelected =
                      selectedMonth?.getFullYear() === viewYear &&
                      selectedMonth?.getMonth() + 1 === m
                    const isCurrentMonth =
                      currentPhysicalYear === viewYear && currentPhysicalMonth === m
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.monthItem,
                          {
                            backgroundColor: isSelected
                              ? colors.primary
                              : isCurrentMonth
                                ? colors.primary + '15'
                                : colors.bgSurfaceHighest,
                            borderColor:
                              isCurrentMonth && !isSelected ? colors.primary : 'transparent'
                          }
                        ]}
                        onPress={() => handleSelectMonth(m)}
                      >
                        <Text
                          style={[
                            styles.monthText,
                            {
                              color: isSelected
                                ? colors.bgSurface
                                : isCurrentMonth
                                  ? colors.primary
                                  : colors.textPrimary
                            }
                          ]}
                        >
                          {name}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            </View>

            <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
              <TouchableOpacity
                style={[styles.footerBtn, { backgroundColor: colors.bgSurfaceHighest }]}
                onPress={handleClear}
              >
                <Text style={[styles.footerBtnText, { color: colors.textSecondary }]}>
                  查看全部
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerBtn, { backgroundColor: colors.primary }]}
                onPress={handleThisMonth}
              >
                <Text style={[styles.footerBtnText, { color: colors.bgSurface }]}>跳转本月</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}
