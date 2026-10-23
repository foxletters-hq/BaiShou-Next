import React from 'react'
import { View, Text, Pressable, TextInput } from 'react-native'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react-native'
import { Button } from '../Button'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { sharedTokens } from '../../theme/tokens'
import { promptShortcutSheetStyles as styles } from './prompt-shortcut-sheet.styles'

/** 列表面板区块所需配色（与 useNativeTheme 的 colors 结构兼容） */
interface PromptShortcutSheetColors {
  textPrimary: string
  textSecondary: string
  textTertiary: string
  primaryContainer: string
  borderMuted: string
  bgSurface: string
  borderControl: string
  borderSubtle: string
}

/** 搜索区：斜杠提示、搜索框与可选的拖动排序提示 */
export function PromptShortcutSearchSection(props: {
  hint: string
  searchQuery: string
  onChangeSearchQuery: (value: string) => void
  placeholder: string
  dragHint?: string
  colors: PromptShortcutSheetColors
}) {
  const { hint, searchQuery, onChangeSearchQuery, placeholder, dragHint, colors } = props

  return (
    <>
      <Text
        style={[
          styles.slashHint,
          {
            color: colors.textSecondary,
            backgroundColor: colors.primaryContainer,
            borderColor: colors.borderMuted
          }
        ]}
      >
        {hint}
      </Text>

      <View
        style={[
          styles.searchRow,
          {
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderControl
          }
        ]}
      >
        <Search size={20} color={colors.textTertiary} strokeWidth={DEFAULT_STROKE_WIDTH} />
        <TextInput
          value={searchQuery}
          onChangeText={onChangeSearchQuery}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          style={[styles.searchInput, { color: colors.textPrimary }]}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 ? (
          <Pressable onPress={() => onChangeSearchQuery('')} hitSlop={8}>
            <X size={18} color={colors.textTertiary} strokeWidth={DEFAULT_STROKE_WIDTH} />
          </Pressable>
        ) : null}
      </View>

      {dragHint ? (
        <Text style={[styles.dragHint, { color: colors.textTertiary }]}>{dragHint}</Text>
      ) : null}
    </>
  )
}

/** 列表空态：无匹配结果或尚无快捷指令 */
export function PromptShortcutEmptyState(props: {
  text: string
  canAdd: boolean
  addLabel: string
  onAdd: () => void
  colors: Pick<PromptShortcutSheetColors, 'textSecondary'>
}) {
  const { text, canAdd, addLabel, onAdd, colors } = props

  return (
    <View style={[styles.emptyContainer, { padding: sharedTokens.spacing.lg }]}>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{text}</Text>
      {canAdd ? (
        <Button size="sm" onPress={onAdd}>
          + {addLabel}
        </Button>
      ) : null}
    </View>
  )
}

/** 分页栏：页码信息与上一页/下一页按钮 */
export function PromptShortcutPaginationBar(props: {
  pageInfo: string
  currentPage: number
  totalPages: number
  onChangePage: (page: number) => void
  colors: Pick<
    PromptShortcutSheetColors,
    'borderSubtle' | 'textSecondary' | 'borderControl' | 'textPrimary'
  >
}) {
  const { pageInfo, currentPage, totalPages, onChangePage, colors } = props

  return (
    <View style={[styles.paginationBar, { borderTopColor: colors.borderSubtle }]}>
      <Text style={[styles.pageMeta, { color: colors.textSecondary }]}>{pageInfo}</Text>
      <View style={styles.pageNavBtns}>
        <Pressable
          style={[
            styles.pageNavBtn,
            {
              borderColor: colors.borderControl,
              opacity: currentPage <= 1 ? 0.4 : 1
            }
          ]}
          disabled={currentPage <= 1}
          onPress={() => onChangePage(currentPage - 1)}
        >
          <ChevronLeft size={22} color={colors.textPrimary} strokeWidth={DEFAULT_STROKE_WIDTH} />
        </Pressable>
        <Pressable
          style={[
            styles.pageNavBtn,
            {
              borderColor: colors.borderControl,
              opacity: currentPage >= totalPages ? 0.4 : 1
            }
          ]}
          disabled={currentPage >= totalPages}
          onPress={() => onChangePage(currentPage + 1)}
        >
          <ChevronRight size={22} color={colors.textPrimary} strokeWidth={DEFAULT_STROKE_WIDTH} />
        </Pressable>
      </View>
    </View>
  )
}
