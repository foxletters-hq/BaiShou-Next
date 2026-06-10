import React, { useState, useCallback, useEffect } from 'react'
import { View, Text, Pressable, TextInput } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { paginationStyles as styles } from './pagination.styles'

export interface NativePaginationProps {
  /** 当前页码（从 1 开始） */
  current: number
  /** 总页数 */
  total: number
  /** 页码变化回调 */
  onChange: (page: number) => void
  /** 相邻页码按钮数量（默认 1） */
  siblingCount?: number
  /** 是否显示首页/末页按钮 */
  showFirstLast?: boolean
  /** 是否显示页码输入跳转框 */
  showJumper?: boolean
  /** 是否禁用 */
  disabled?: boolean
}

/** 计算页码范围 */
function getPageRange(
  current: number,
  total: number,
  siblingCount: number
): (number | 'ellipsis')[] {
  const pages: (number | 'ellipsis')[] = []

  const totalPageNumbers = siblingCount * 2 + 3
  if (total <= totalPageNumbers) {
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
    return pages
  }

  const leftSiblingIndex = Math.max(current - siblingCount, 1)
  const rightSiblingIndex = Math.min(current + siblingCount, total)

  const showLeftEllipsis = leftSiblingIndex > 2
  const showRightEllipsis = rightSiblingIndex < total - 1

  if (!showLeftEllipsis) {
    for (let i = 1; i <= rightSiblingIndex + 1; i++) {
      pages.push(i)
    }
    pages.push('ellipsis')
    pages.push(total)
    return pages
  }

  if (!showRightEllipsis) {
    pages.push(1)
    pages.push('ellipsis')
    for (let i = leftSiblingIndex - 1; i <= total; i++) {
      pages.push(i)
    }
    return pages
  }

  pages.push(1)
  pages.push('ellipsis')
  for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
    pages.push(i)
  }
  pages.push('ellipsis')
  pages.push(total)

  return pages
}

export const Pagination: React.FC<NativePaginationProps> = ({
  current,
  total,
  onChange,
  siblingCount = 1,
  showFirstLast = true,
  showJumper = true,
  disabled = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const pageUnitLabel = t('common.pagination_page_unit', 'Page')

  const [jumperValue, setJumperValue] = useState(() => String(current))

  useEffect(() => {
    setJumperValue(String(current))
  }, [current])

  const handlePageChange = useCallback(
    (page: number) => {
      if (disabled) return
      const safePage = Math.max(1, Math.min(total, page))
      if (safePage !== current) {
        onChange(safePage)
      }
    },
    [disabled, total, current, onChange]
  )

  const handleJumperSubmit = useCallback(() => {
    if (disabled) return
    const page = parseInt(jumperValue, 10)
    if (!isNaN(page) && page >= 1 && page <= total) {
      handlePageChange(page)
      return
    }
    setJumperValue(String(current))
  }, [disabled, jumperValue, total, current, handlePageChange])

  const pageRange = getPageRange(current, total, siblingCount)

  const navBtnStyle = (isDisabled: boolean) => [
    styles.pageBtn,
    {
      backgroundColor: colors.bgSurface,
      borderColor: colors.borderSubtle,
      opacity: isDisabled ? 0.35 : 1
    }
  ]

  const renderPageButton = (page: number | 'ellipsis', index: number) => {
    if (page === 'ellipsis') {
      return (
        <View key={`ellipsis-${index}`} style={styles.ellipsis}>
          <Text style={[styles.ellipsisText, { color: colors.textTertiary }]}>···</Text>
        </View>
      )
    }

    const isActive = page === current
    return (
      <Pressable
        key={page}
        onPress={() => handlePageChange(page)}
        disabled={disabled}
        style={[
          styles.pageBtn,
          {
            backgroundColor: isActive ? colors.primary : colors.bgSurface,
            borderColor: isActive ? colors.primary : colors.borderSubtle,
            opacity: disabled ? 0.5 : 1
          },
          isActive && {
            ...styles.pageBtnActive,
            shadowColor: colors.primary
          }
        ]}
      >
        <Text
          style={[
            styles.pageBtnText,
            isActive ? styles.pageBtnTextActive : null,
            { color: isActive ? colors.onPrimary : colors.textPrimary }
          ]}
        >
          {page}
        </Text>
      </Pressable>
    )
  }

  return (
    <View style={styles.root}>
      {showFirstLast && (
        <Pressable
          onPress={() => handlePageChange(1)}
          disabled={disabled || current <= 1}
          style={navBtnStyle(disabled || current <= 1)}
          accessibilityLabel={t('common.pagination_first_page', 'First page')}
        >
          <MaterialIcons
            name="keyboard-double-arrow-left"
            size={16}
            color={colors.textPrimary}
          />
        </Pressable>
      )}

      <Pressable
        onPress={() => handlePageChange(current - 1)}
        disabled={disabled || current <= 1}
        style={navBtnStyle(disabled || current <= 1)}
        accessibilityLabel={t('common.pagination_previous_page', 'Previous page')}
      >
        <MaterialIcons name="chevron-left" size={18} color={colors.textPrimary} />
      </Pressable>

      {pageRange.map((page, index) => renderPageButton(page, index))}

      <Pressable
        onPress={() => handlePageChange(current + 1)}
        disabled={disabled || current >= total}
        style={navBtnStyle(disabled || current >= total)}
        accessibilityLabel={t('common.pagination_next_page', 'Next page')}
      >
        <MaterialIcons name="chevron-right" size={18} color={colors.textPrimary} />
      </Pressable>

      {showFirstLast && (
        <Pressable
          onPress={() => handlePageChange(total)}
          disabled={disabled || current >= total}
          style={navBtnStyle(disabled || current >= total)}
          accessibilityLabel={t('common.pagination_last_page', 'Last page')}
        >
          <MaterialIcons
            name="keyboard-double-arrow-right"
            size={16}
            color={colors.textPrimary}
          />
        </Pressable>
      )}

      {showJumper && total > 1 && (
        <View style={styles.jumper}>
          <TextInput
            value={jumperValue}
            onChangeText={(text) => {
              const val = text.replace(/[^0-9]/g, '')
              setJumperValue(val)
            }}
            onSubmitEditing={handleJumperSubmit}
            onBlur={handleJumperSubmit}
            keyboardType="number-pad"
            returnKeyType="go"
            editable={!disabled}
            selectTextOnFocus
            style={[
              styles.jumperInput,
              {
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle,
                color: colors.textPrimary
              }
            ]}
          />
          <Text style={[styles.jumperSuffix, { color: colors.textTertiary }]}>
            {pageUnitLabel}
          </Text>
        </View>
      )}
    </View>
  )
}
