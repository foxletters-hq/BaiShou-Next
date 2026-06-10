import React, { useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Input } from '../Input/Input'

interface RagMemorySearchSectionProps {
  searchQuery?: string
  searchMode?: 'semantic' | 'text'
  onSearch: (query: string, mode: 'semantic' | 'text') => void
}

export const RagMemorySearchSection: React.FC<RagMemorySearchSectionProps> = ({
  searchQuery = '',
  searchMode = 'semantic',
  onSearch
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
      onSearch(searchQuery, mode)
    },
    [onSearch, searchMode, searchQuery]
  )

  return (
    <View
      style={[
        styles.searchBox,
        {
          backgroundColor: colors.bgGlassSurface,
          borderColor: colors.borderMuted
        }
      ]}
    >
      <View style={styles.inputCluster}>
        <Input
          className="min-h-0 flex-1 border-0 bg-transparent px-0"
          containerStyle={styles.searchInputWrap}
          style={[styles.searchInput, { color: colors.textPrimary }]}
          value={searchQuery}
          onChangeText={handleQueryChange}
          placeholder={t('agent.rag.search_hint')}
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
      </View>

      <View style={[styles.segmented, { backgroundColor: colors.bgSurfaceNormal }]}>
        {(['semantic', 'text'] as const).map((mode) => {
          const active = searchMode === mode
          return (
            <TouchableOpacity
              key={mode}
              activeOpacity={0.7}
              style={[styles.segmentBtn, active && { backgroundColor: colors.bgSurface }]}
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
  inputCluster: {
    flex: 1,
    minWidth: 120
  },
  searchInputWrap: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    margin: 0
  },
  searchInput: {
    fontSize: 14,
    paddingVertical: 2,
    minHeight: 32,
    backgroundColor: 'transparent'
  },
  segmented: {
    flexDirection: 'row',
    flexShrink: 0,
    padding: 2,
    borderRadius: 8,
    gap: 2
  },
  segmentBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  segmentText: {
    fontSize: 11,
    fontWeight: '600'
  },
  segmentTextActive: {
    fontWeight: '700'
  }
})
