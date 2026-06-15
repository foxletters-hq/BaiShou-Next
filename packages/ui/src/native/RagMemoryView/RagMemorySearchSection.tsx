import React, { useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Input } from '../Input/Input'

interface RagMemorySearchSectionProps {
  searchQuery?: string
  searchMode?: 'semantic' | 'text'
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
    : searchMode === 'semantic'
      ? t('settings.rag_search_semantic_hint', '语义搜索记忆内容...')
      : t('settings.rag_search_text_hint', '文本搜索记忆内容...')

  return (
    <View
      style={[
        styles.searchBox,
        compact && styles.searchBoxCompact,
        {
          backgroundColor: colors.bgGlassSurface,
          borderColor: colors.borderMuted
        }
      ]}
    >
      <View style={[styles.inputCluster, compact && styles.inputClusterCompact]}>
        <Input
          className="min-h-0 flex-1 border-0 bg-transparent px-0"
          containerStyle={[styles.searchInputWrap, compact && styles.searchInputWrapCompact]}
          style={[
            styles.searchInput,
            compact && styles.searchInputCompact,
            { color: colors.textPrimary }
          ]}
          textAlignVertical="center"
          value={searchQuery}
          onChangeText={handleQueryChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
          returnKeyType="search"
          leftSlot={
            compact ? undefined : (
              <MaterialIcons name="search" size={18} color={colors.textSecondary} />
            )
          }
          rightSlot={
            searchQuery.length > 0 ? (
              <TouchableOpacity
                onPress={handleClear}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="close" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            ) : undefined
          }
        />
      </View>

      <View
        style={[
          styles.segmented,
          compact && styles.segmentedCompact,
          { backgroundColor: colors.bgSurfaceNormal }
        ]}
      >
        {(['semantic', 'text'] as const).map((mode) => {
          const active = searchMode === mode
          return (
            <TouchableOpacity
              key={mode}
              activeOpacity={0.7}
              style={[
                styles.segmentBtn,
                compact && styles.segmentBtnCompact,
                active && { backgroundColor: colors.bgSurface }
              ]}
              onPress={() => handleModeChange(mode)}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: active ? colors.primary : colors.textSecondary },
                  active && styles.segmentTextActive
                ]}
                numberOfLines={1}
              >
                {mode === 'semantic'
                  ? t('settings.rag_search_semantic')
                  : t('settings.rag_search_text')}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 8
  },
  searchBoxCompact: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 6,
    minHeight: 40,
    alignItems: 'center'
  },
  inputCluster: {
    flex: 1,
    minWidth: 120
  },
  inputClusterCompact: {
    minWidth: 56,
    justifyContent: 'center'
  },
  searchInputWrap: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    margin: 0
  },
  searchInputWrapCompact: {
    justifyContent: 'center'
  },
  searchInput: {
    fontSize: 14,
    paddingVertical: 2,
    minHeight: 32,
    backgroundColor: 'transparent'
  },
  searchInputCompact: {
    fontSize: 14,
    height: 28,
    minHeight: 28,
    maxHeight: 28,
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 0,
    marginVertical: 0,
    lineHeight: Platform.OS === 'ios' ? 18 : 20,
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false, textAlignVertical: 'center' as const }
      : null)
  },
  segmented: {
    flexDirection: 'row',
    flexShrink: 0,
    padding: 2,
    borderRadius: 8,
    gap: 2
  },
  segmentedCompact: {
    padding: 2,
    gap: 2,
    alignSelf: 'center'
  },
  segmentBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  segmentBtnCompact: {
    paddingHorizontal: 6,
    paddingVertical: 4
  },
  segmentText: {
    fontSize: 11,
    fontWeight: '600'
  },
  segmentTextActive: {
    fontWeight: '700'
  }
})
