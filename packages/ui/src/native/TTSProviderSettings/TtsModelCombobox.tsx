import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
  type StyleProp,
  type ViewStyle
} from 'react-native'
import { Check, Pencil, X } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { settingsSelectorStyles } from '../SettingsSelector/settings-selector.styles'
import { mobileControlTokens, mobileTypography, sharedTokens } from '../../theme/tokens'

interface TtsModelComboboxProps {
  value: string
  placeholder: string
  options: string[]
  isOpen: boolean
  onChangeText: (text: string) => void
  onFocus: () => void
  onToggleDropdown: () => void
  onSelect: (modelId: string) => void
  triggerStyle?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
  compact?: boolean
}

export const TtsModelCombobox: React.FC<TtsModelComboboxProps> = ({
  value,
  placeholder,
  options,
  isOpen,
  onChangeText,
  onFocus,
  onToggleDropdown,
  onSelect,
  triggerStyle,
  style,
  compact = false
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
    <View style={[compact ? comboboxStyles.compactWrapper : comboboxStyles.wrapper, style]}>
      <TouchableOpacity
        activeOpacity={0.7}
        style={[
          settingsSelectorStyles.trigger,
          {
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderControl,
            borderRadius: sharedTokens.radius.lg,
            minHeight: mobileControlTokens.height,
            paddingHorizontal: mobileControlTokens.inputPaddingHorizontal,
            paddingVertical: mobileControlTokens.inputPaddingVertical
          },
          compact && {
            minHeight: 32,
            paddingHorizontal: sharedTokens.spacing.smPlus,
            paddingVertical: sharedTokens.spacing.xxs,
            borderRadius: sharedTokens.radius.md,
            gap: sharedTokens.spacing.xs
          },
          triggerStyle
        ]}
        onPress={() => {
          onFocus()
          onToggleDropdown()
        }}
      >
        <Text
          style={[
            settingsSelectorStyles.triggerValue,
            {
              fontSize: mobileTypography.secondary.fontSize,
              color: hasValue ? colors.textPrimary : colors.textTertiary
            }
          ]}
          numberOfLines={1}
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
                borderColor: colors.borderMuted,
                borderRadius: tokens.radius.lg
              }
            ]}
          >
            <View style={[comboboxStyles.modalHeader, { borderBottomColor: colors.borderMuted }]}>
              <Text style={[comboboxStyles.modalTitle, { color: colors.textPrimary }]}>
                {t('tts.settings.model_id_label', '模型 ID')}
              </Text>
              <TouchableOpacity onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={22} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
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
                    borderColor: colors.borderControl
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
                  <Pencil size={18} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
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
                    {selected && (
                      <Check size={18} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
                    )}
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
  compactWrapper: {
    flex: 1,
    minWidth: 100
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
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.mdSnug,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  modalTitle: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  },
  searchWrap: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.mdTight,
    paddingBottom: sharedTokens.spacing.sm
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: mobileControlTokens.radius,
    paddingHorizontal: mobileControlTokens.inputPaddingHorizontal,
    paddingVertical: mobileControlTokens.inputPaddingVertical,
    minHeight: mobileControlTokens.height,
    fontSize: mobileTypography.secondary.fontSize
  },
  optionsList: {
    maxHeight: 320
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.mdTight,
    gap: sharedTokens.spacing.sm
  },
  optionText: {
    flex: 1,
    fontSize: mobileTypography.secondary.fontSize
  }
})
