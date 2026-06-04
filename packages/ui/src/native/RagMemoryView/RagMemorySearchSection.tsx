import React, { useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Input } from '../Input/Input'
import { SettingsSection } from '../SettingsSection'
import { ragMemoryStyles as styles } from './rag-memory.styles'

interface RagMemorySearchSectionProps {
  onSearch: (query: string, mode: 'semantic' | 'text') => void
}

export const RagMemorySearchSection: React.FC<RagMemorySearchSectionProps> = ({ onSearch }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'semantic' | 'text'>('semantic')

  const handleSearch = () => {
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim(), searchMode)
    }
  }

  return (
    <SettingsSection title={t('common.search')}>
      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.bgSurfaceHigh,
              borderColor: colors.borderMuted
            }
          ]}
        >
          <Input
            style={{ flex: 1, fontSize: 14 }}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              searchMode === 'semantic'
                ? t('settings.rag_search_semantic_hint')
                : t('settings.rag_search_text_hint')
            }
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
        </View>
        <TouchableOpacity
          style={[
            {
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: colors.primary,
              opacity: searchQuery.trim() ? 1 : 0.5
            }
          ]}
          onPress={handleSearch}
          disabled={!searchQuery.trim()}
          activeOpacity={0.7}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
            {t('common.search')}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.modeRow}>
        {(['semantic', 'text'] as const).map((mode) => {
          const active = searchMode === mode
          return (
            <TouchableOpacity
              key={mode}
              activeOpacity={0.7}
              style={[
                styles.modeChip,
                {
                  borderColor: active ? colors.primary : colors.borderMuted,
                  backgroundColor: active ? colors.primaryLight : 'transparent'
                }
              ]}
              onPress={() => setSearchMode(mode)}
            >
              <Text
                style={[
                  styles.modeText,
                  {
                    color: active ? colors.primary : colors.textSecondary,
                    fontWeight: active ? '600' : '500'
                  }
                ]}
              >
                {mode === 'semantic'
                  ? t('settings.rag_search_semantic')
                  : t('settings.rag_search_text')}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </SettingsSection>
  )
}
