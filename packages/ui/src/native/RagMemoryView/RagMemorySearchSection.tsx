import React, { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Button } from '../Button'
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
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.bgSurfaceNormal,
              color: colors.textPrimary,
              borderColor: colors.borderMuted
            }
          ]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={
            searchMode === 'semantic'
              ? t('settings.rag_search_semantic_hint')
              : t('settings.rag_search_text_hint')
          }
          placeholderTextColor={colors.textTertiary}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        <Button onPress={handleSearch} disabled={!searchQuery.trim()}>
          {t('common.search')}
        </Button>
      </View>
      <View style={styles.modeRow}>
        {(['semantic', 'text'] as const).map((mode) => (
          <TouchableOpacity
            key={mode}
            activeOpacity={0.7}
            style={[
              styles.modeChip,
              {
                borderColor: searchMode === mode ? colors.primary : colors.borderMuted,
                backgroundColor: searchMode === mode ? colors.primaryLight : 'transparent'
              }
            ]}
            onPress={() => setSearchMode(mode)}
          >
            <Text
              style={[
                styles.modeText,
                {
                  color: searchMode === mode ? colors.primary : colors.textSecondary
                }
              ]}
            >
              {mode === 'semantic'
                ? t('settings.rag_search_semantic')
                : t('settings.rag_search_text')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SettingsSection>
  )
}
