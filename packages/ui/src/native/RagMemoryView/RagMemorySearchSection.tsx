import i18n from 'i18next'
import React, { useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform, TextInput } from 'react-native'
import { Search, X } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import {
  RAG_VECTOR_KIND_FILTERS,
  ragVectorKindLabelKey,
  type RagVectorKindFilter
} from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { Input } from '../Input/Input'
import { SegmentedControl } from '../SegmentedControl'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

interface RagMemorySearchSectionProps {
  searchQuery?: string
  searchMode?: 'semantic' | 'text'
  sourceKind?: RagVectorKindFilter
  onSourceKindChange?: (kind: RagVectorKindFilter) => void
  onSearch: (query: string, mode: 'semantic' | 'text') => void
  /** 语义搜索是否可用（RAG 已启用且嵌入模型已配置） */
  semanticAvailable?: boolean
  /** 用户选择语义搜索但不可用时触发 */
  onSemanticUnavailable?: () => void
  autoFocus?: boolean
  /** 紧凑布局：短占位符、无搜索图标，适合日记顶栏等窄空间 */
  compact?: boolean
}

export const RagMemorySearchSection: React.FC<RagMemorySearchSectionProps> = ({
  searchQuery = '',
  searchMode = 'semantic',
  sourceKind = 'all',
  onSourceKindChange,
  onSearch,
  semanticAvailable = true,
  onSemanticUnavailable,
  autoFocus = false,
  compact = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const handleQueryChange = useCallback(
    (text: string) => {
      onSearch(text, searchMode)
    },
    [onSearch, searchMode]
  )

  const handleClear = useCallback(() => {
    onSearch('', searchMode)
  }, [onSearch, searchMode])

  const handleModeChange = useCallback(
    (mode: 'semantic' | 'text') => {
      if (mode === searchMode) return
      if (mode === 'semantic' && !semanticAvailable) {
        onSemanticUnavailable?.()
        return
      }
      onSearch(searchQuery, mode)
    },
    [onSearch, searchMode, searchQuery, semanticAvailable, onSemanticUnavailable]
  )

  const placeholder = compact
    ? t('common.please_search', '请搜索')
    : t('settings.rag_search_placeholder', '搜索记忆')

  const kindFallback: Record<RagVectorKindFilter, string> = {
    all: i18n.t('auto.packages.ui.src.native.RagMemoryView.RagMemorySearchSection.L73', '全部'),
    diary: i18n.t('auto.packages.ui.src.native.RagMemoryView.RagMemorySearchSection.L74', '日记'),
    partner: i18n.t('auto.packages.ui.src.native.RagMemoryView.RagMemorySearchSection.L75', '伙伴'),
    manual: i18n.t('auto.packages.ui.src.native.RagMemoryView.RagMemorySearchSection.L76', '手动'),
    graph_node: i18n.t(
      'auto.packages.ui.src.native.RagMemoryView.RagMemorySearchSection.L77',
      '节点'
    )
  }

  const searchInput =
    compact || Platform.OS === 'android' ? (
      <View
        style={[
          styles.searchInputWrap,
          compact ? styles.inputClusterCompact : styles.androidSearchRow
        ]}
      >
        {compact ? null : (
          <Search size={16} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
        )}
        <TextInput
          style={[
            compact ? styles.searchInputCompact : styles.searchInput,
            { color: colors.textPrimary }
          ]}
          value={searchQuery}
          onChangeText={handleQueryChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          autoFocus={autoFocus}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity
            onPress={handleClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <X size={14} color={colors.textTertiary} strokeWidth={DEFAULT_STROKE_WIDTH} />
          </TouchableOpacity>
        ) : null}
      </View>
    ) : (
      <Input
        className="min-h-0 flex-1 border-0 bg-transparent px-0"
        containerStyle={styles.searchInputWrap}
        style={[styles.searchInput, { color: colors.textPrimary }]}
        textAlignVertical="center"
        value={searchQuery}
        onChangeText={handleQueryChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        returnKeyType="search"
        leftSlot={
          <Search size={16} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
        }
        rightSlot={
          searchQuery.length > 0 ? (
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <X size={14} color={colors.textTertiary} strokeWidth={DEFAULT_STROKE_WIDTH} />
            </TouchableOpacity>
          ) : undefined
        }
      />
    )

  return (
    <View style={styles.searchStack}>
      <View style={[styles.toolbar, compact && styles.toolbarCompact]}>
        <View
          style={[
            styles.searchBox,
            compact && styles.searchBoxCompact,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderControl
            }
          ]}
        >
          {searchInput}
        </View>
        <SegmentedControl
          size="small"
          stretch={false}
          value={searchMode}
          accessibilityLabel={t('settings.rag_search_mode', '搜索模式')}
          onChange={handleModeChange}
          options={[
            { value: 'semantic', label: t('settings.rag_search_semantic', '语义搜索') },
            { value: 'text', label: t('settings.rag_search_text', '文本搜索') }
          ]}
        />
      </View>
      {!compact && onSourceKindChange ? (
        <View style={styles.kindRow}>
          {RAG_VECTOR_KIND_FILTERS.map((kind) => {
            const active = sourceKind === kind
            return (
              <TouchableOpacity
                key={kind}
                activeOpacity={0.7}
                onPress={() => onSourceKindChange(kind)}
                style={[
                  styles.kindChip,
                  {
                    borderColor: active ? colors.primary : colors.borderControl,
                    backgroundColor: active ? colors.primaryLight : colors.bgSurface
                  }
                ]}
              >
                <Text
                  style={{
                    color: active ? colors.primary : colors.textSecondary,
                    fontSize: mobileTypography.secondary.fontSize,
                    fontWeight: mobileTypography.secondary.fontWeight
                  }}
                >
                  {t(ragVectorKindLabelKey(kind), kindFallback[kind])}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  searchStack: {
    gap: sharedTokens.spacing.sm
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  toolbarCompact: {
    flexWrap: 'nowrap'
  },
  kindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.xsPlus
  },
  kindChip: {
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.xsPlus,
    borderRadius: sharedTokens.radius.full,
    borderWidth: 1
  },
  searchBox: {
    flex: 1,
    minWidth: 120,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: sharedTokens.radius.sm,
    borderWidth: 1,
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: 0
  },
  searchBoxCompact: {
    minWidth: 0,
    paddingHorizontal: sharedTokens.spacing.sm,
    paddingVertical: 0,
    height: 40
  },
  searchInputWrap: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    margin: 0
  },
  androidSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  },
  inputClusterCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40
  },
  searchInput: {
    flex: 1,
    fontSize: mobileTypography.secondary.fontSize,
    paddingVertical: 0,
    minHeight: 0,
    height: 32,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false, textAlignVertical: 'center' as const }
      : {})
  },
  searchInputCompact: {
    flex: 1,
    fontSize: mobileTypography.secondary.fontSize,
    height: 40,
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false, textAlignVertical: 'center' as const }
      : { paddingTop: 0, paddingBottom: 0 })
  }
})
