import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Pressable,
  StyleSheet
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'
import { ttsProviderSettingsStyles as styles } from './tts-provider-settings.styles'

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
  const { colors } = useNativeTheme()
  const [layoutHeight, setLayoutHeight] = useState(0)

  const filteredOptions = useMemo(() => {
    if (showAllOptions || !value.trim()) return options
    const query = value.toLowerCase().trim()
    const filtered = options.filter((opt) => opt.toLowerCase().includes(query))
    return filtered.length > 0 ? filtered : options
  }, [options, showAllOptions, value])

  return (
    <View
      style={comboboxStyles.wrapper}
      onLayout={(e) => setLayoutHeight(e.nativeEvent.layout.height)}
    >
      <View
        style={[
          comboboxStyles.inputShell,
          {
            borderColor: isOpen ? colors.primary : colors.borderStrong,
            backgroundColor: colors.bgSurface
          }
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          style={[comboboxStyles.input, { color: colors.textPrimary }]}
        />
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onToggleDropdown}
          style={comboboxStyles.arrowBtn}
          accessibilityRole="button"
        >
          <MaterialIcons
            name={isOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
            size={22}
            color={isOpen ? colors.primary : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {isOpen && filteredOptions.length > 0 && (
        <>
          <Pressable style={comboboxStyles.backdrop} onPress={onToggleDropdown} />
          <View
            style={[
              comboboxStyles.dropdown,
              {
                top: layoutHeight + 4,
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderMuted,
                shadowColor: colors.textPrimary
              }
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              style={comboboxStyles.optionsList}
            >
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
                    onPress={() => onSelect(opt)}
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
                      <MaterialIcons name="check" size={16} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  )
}

const comboboxStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    position: 'relative',
    zIndex: 20
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 48,
    paddingLeft: 12,
    paddingRight: 4
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10
  },
  arrowBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10
  },
  dropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    maxHeight: 200,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden'
  },
  optionsList: {
    maxHeight: 200
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8
  },
  optionText: {
    flex: 1,
    fontSize: 14
  }
})
