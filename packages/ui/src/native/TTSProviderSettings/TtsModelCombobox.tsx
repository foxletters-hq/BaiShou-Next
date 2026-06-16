import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { settingsSelectorStyles } from '../SettingsSelector/settings-selector.styles'

interface TtsModelComboboxProps {
  value: string
  placeholder: string
  options: string[]
  isOpen: boolean
  onChangeText: (text: string) => void
  onFocus: () => void
  onToggleDropdown: () => void
  onSelect: (modelId: string) => void
}

export const TtsModelCombobox: React.FC<TtsModelComboboxProps> = ({
  value,
  placeholder,
  options,
  isOpen,
  onChangeText,
  onFocus,
  onToggleDropdown,
  onSelect
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [searchQuery, setSearchQuery] = useState('')

  const filteredOptions = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return options
    const filtered = options.filter((opt) => opt.toLowerCase().includes(query))
    return filtered.length > 0 ? filtered : options
  }, [options, searchQuery])

  const hasValue = Boolean(value.trim())

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
    }
  }, [isOpen])

  const close = () => {
    if (isOpen) onToggleDropdown()
  }

  const applyCustom = () => {
    const next = searchQuery.trim()
    if (!next) return
    onChangeText(next)
    onSelect(next)
    close()
  }

  const showCustomApply =
    searchQuery.trim().length > 0 &&
    !filteredOptions.some((opt) => opt.toLowerCase() === searchQuery.trim().toLowerCase())

  return (
    <View style={comboboxStyles.wrapper}>
      <TouchableOpacity
        activeOpacity={0.7}
        style={[
          settingsSelectorStyles.trigger,
          {
            backgroundColor: colors.bgSurface,
            borderColor: hasValue ? colors.borderMuted : colors.borderSubtle
          }
        ]}
        onPress={() => {
          onFocus()
          onToggleDropdown()
        }}
      >
        <Text
          style={[
            settingsSelectorStyles.triggerValue,
            { color: hasValue ? colors.textPrimary : colors.textTertiary }
          ]}
          numberOfLines={2}
        >
          {hasValue ? value : placeholder}
        </Text>
        <Text style={[settingsSelectorStyles.chevron, { color: colors.textTertiary }]}>›</Text>
      </TouchableOpacity>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={close}>
        <View style={settingsSelectorStyles.modalOverlay}>
          <Pressable
            style={[settingsSelectorStyles.modalBackdrop, { backgroundColor: colors.bgOverlay }]}
            onPress={close}
          />

          <View
            style={[
              comboboxStyles.modalPanel,
              {
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle,
                borderRadius: tokens.radius.lg
              }
            ]}
          >
            <View style={[comboboxStyles.modalHeader, { borderBottomColor: colors.borderSubtle }]}>
              <Text style={[comboboxStyles.modalTitle, { color: colors.textPrimary }]}>
                {t('tts.settings.model_id_label', '模型 ID')}
              </Text>
              <TouchableOpacity onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={comboboxStyles.searchWrap}>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('common.search_model', '搜索模型...')}
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  comboboxStyles.searchInput,
                  {
                    color: colors.textPrimary,
                    backgroundColor: colors.bgSurface,
                    borderColor: colors.borderSubtle
                  }
                ]}
              />
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={comboboxStyles.optionsList}
              showsVerticalScrollIndicator={false}
            >
              {showCustomApply && (
                <TouchableOpacity
                  style={[comboboxStyles.optionItem, { backgroundColor: colors.primaryLight }]}
                  onPress={applyCustom}
                >
                  <MaterialIcons name="edit" size={18} color={colors.primary} />
                  <Text
                    style={[comboboxStyles.optionText, { color: colors.primary }]}
                    numberOfLines={1}
                  >
                    {t('tts.settings.use_custom_model', '使用')}: {searchQuery.trim()}
                  </Text>
                </TouchableOpacity>
              )}

              {filteredOptions.map((opt, index) => {
                const selected = opt === value
                return (
                  <TouchableOpacity
                    key={`${opt}-${index}`}
                    activeOpacity={0.7}
                    style={[
                      comboboxStyles.optionItem,
                      selected && { backgroundColor: colors.primaryLight }
                    ]}
                    onPress={() => {
                      onSelect(opt)
                      close()
                    }}
                  >
                    <Text
                      style={[
                        comboboxStyles.optionText,
                        { color: selected ? colors.primary : colors.textPrimary }
                      ]}
                      numberOfLines={1}
                    >
                      {opt}
                    </Text>
                    {selected && <MaterialIcons name="check" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const comboboxStyles = StyleSheet.create({
  wrapper: {
    flex: 1
  },
  modalPanel: {
    width: '90%',
    maxWidth: 360,
    maxHeight: '70%',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600'
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14
  },
  optionsList: {
    maxHeight: 320
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8
  },
  optionText: {
    flex: 1,
    fontSize: 14
  }
})
