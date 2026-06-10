import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Modal,
  Animated,
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
  showAllOptions: boolean
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
  showAllOptions,
  isOpen,
  onChangeText,
  onFocus,
  onToggleDropdown,
  onSelect
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [mounted, setMounted] = useState(false)
  const [draft, setDraft] = useState(value)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.92)).current

  const filteredOptions = useMemo(() => {
    const query = draft.toLowerCase().trim()
    const base =
      showAllOptions || !query
        ? options
        : options.filter((opt) => opt.toLowerCase().includes(query))
    return base.length > 0 ? base : options
  }, [options, showAllOptions, draft])

  const hasValue = Boolean(value.trim())

  useEffect(() => {
    if (!isOpen) {
      if (!mounted) return
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.92,
          duration: 160,
          useNativeDriver: true
        })
      ]).start(({ finished }) => {
        if (finished) setMounted(false)
      })
      return
    }

    setDraft(value)
    setMounted(true)
    fadeAnim.setValue(0)
    scaleAnim.setValue(0.92)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11
      })
    ]).start()
  }, [isOpen, mounted, value, fadeAnim, scaleAnim])

  const close = () => {
    if (isOpen) onToggleDropdown()
  }

  const applyCustom = () => {
    const next = draft.trim()
    if (!next) return
    onChangeText(next)
    onSelect(next)
    close()
  }

  const showCustomApply =
    draft.trim().length > 0 &&
    !filteredOptions.some((opt) => opt.toLowerCase() === draft.trim().toLowerCase())

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

      <Modal visible={mounted} transparent animationType="none" onRequestClose={close}>
        <View style={settingsSelectorStyles.modalOverlay}>
          <Animated.View
            style={[
              settingsSelectorStyles.modalBackdrop,
              { backgroundColor: colors.bgOverlay, opacity: fadeAnim }
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          </Animated.View>

          <Animated.View
            style={[
              comboboxStyles.modalPanel,
              {
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle,
                borderRadius: tokens.radius.lg,
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }]
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
                value={draft}
                onChangeText={setDraft}
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
                    {t('tts.settings.use_custom_model', '使用')}: {draft.trim()}
                  </Text>
                </TouchableOpacity>
              )}

              {filteredOptions.map((opt) => {
                const selected = opt === value
                return (
                  <TouchableOpacity
                    key={opt}
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
          </Animated.View>
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
