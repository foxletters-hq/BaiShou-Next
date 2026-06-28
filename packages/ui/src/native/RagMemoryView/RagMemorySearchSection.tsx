import React, { useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform, TextInput } from 'react-native'
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
        {compact ? (
          <TextInput
            style={[styles.searchInputCompact, { color: colors.textPrimary }]}
            value={searchQuery}
            onChangeText={handleQueryChange}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            autoFocus={autoFocus}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
        ) : Platform.OS === 'android' ? (
          <View style={[styles.searchInputWrap, styles.androidSearchRow]}>
            <MaterialIcons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, styles.searchInputCompact, { color: colors.textPrimary }]}
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
                <MaterialIcons name="close" size={16} color={colors.textTertiary} />
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
            leftSlot={<MaterialIcons name="search" size={18} color={colors.textSecondary} />}
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
        )}
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
    flexWrap: 'nowrap',
    paddingHorizontal: 8,
    paddingVertical: 0,
    gap: 6,
    height: 40,
    alignItems: 'center'
  },
  inputCluster: {
    flex: 1,
    minWidth: 120
  },
  inputClusterCompact: {
    flex: 1,
    minWidth: 0,
    height: 40,
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
  androidSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  searchInput: {
    fontSize: 14,
    paddingVertical: 2,
    minHeight: 32,
    backgroundColor: 'transparent'
  },
  searchInputCompact: {
    flex: 1,
    fontSize: 14,
    height: 40,
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false, textAlignVertical: 'center' as const }
      : { paddingTop: 0, paddingBottom: 0 })
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
    height: 32,
    alignItems: 'center',
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
