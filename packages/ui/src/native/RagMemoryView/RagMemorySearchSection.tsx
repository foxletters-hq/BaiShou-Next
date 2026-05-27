import React, { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Button } from '../Button'
import { SettingsSection } from '../SettingsSection'
import { ragMemoryStyles as styles } from './rag-memory.styles'

interface RagMemorySearchSectionProps {
  onSearch: (query: string, mode: string) => void
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
    <SettingsSection title={t('rag.search', '记忆搜索')}>
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
          placeholder={t('rag.search_placeholder', '输入搜索关键词')}
          placeholderTextColor={colors.textTertiary}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        <Button onPress={handleSearch} disabled={!searchQuery.trim()}>
          {t('common.search', '搜索')}
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
              {t(
                mode === 'semantic' ? 'rag.semantic' : 'rag.text',
                mode === 'semantic' ? '语义' : '文本'
              )}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SettingsSection>
  )
}
