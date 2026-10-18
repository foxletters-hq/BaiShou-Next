import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type ReturnKeyTypeOptions,
  type StyleProp,
  type TextStyle,
  type ViewStyle
} from 'react-native'
import { Search, X } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export interface CompactSearchBarProps {
  value: string
  onChangeText: (text: string) => void
  onSubmitEditing?: () => void
  placeholder?: string
  placeholderTextColor?: string
  autoFocus?: boolean
  autoCorrect?: boolean
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  style?: StyleProp<ViewStyle>
  inputStyle?: StyleProp<TextStyle>
  onClear?: () => void
  returnKeyType?: ReturnKeyTypeOptions
  leftSlot?: React.ReactNode
  rightSlot?: React.ReactNode
  editable?: boolean
  testID?: string
}

export interface CompactSearchBarRef {
  focus: () => void
  blur: () => void
  clear: () => void
  isFocused: () => boolean
}

export const CompactSearchBar = forwardRef<CompactSearchBarRef, CompactSearchBarProps>(
  (props, ref) => {
    const { colors } = useNativeTheme()
    const inputRef = useRef<TextInput>(null)

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      clear: () => inputRef.current?.clear(),
      isFocused: () => inputRef.current?.isFocused() ?? false
    }))

    const handleClear = () => {
      props.onChangeText('')
      props.onClear?.()
      inputRef.current?.focus()
    }

    return (
      <Pressable
        onPress={() => inputRef.current?.focus()}
        style={[
          styles.container,
          {
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderControl
          },
          props.style
        ]}
      >
        <View pointerEvents="none" style={styles.leftSlot}>
          {props.leftSlot ?? <Search size={16} color={colors.textSecondary} strokeWidth={2} />}
        </View>
        <TextInput
          ref={inputRef}
          value={props.value}
          onChangeText={props.onChangeText}
          onSubmitEditing={props.onSubmitEditing}
          placeholder={props.placeholder}
          placeholderTextColor={props.placeholderTextColor ?? colors.textTertiary}
          autoFocus={props.autoFocus}
          autoCorrect={props.autoCorrect ?? false}
          autoCapitalize={props.autoCapitalize ?? 'none'}
          returnKeyType={props.returnKeyType ?? 'search'}
          editable={props.editable !== false}
          testID={props.testID}
          style={[styles.input, { color: colors.textPrimary }, props.inputStyle]}
        />
        {props.rightSlot ? (
          props.rightSlot
        ) : props.value.length > 0 ? (
          <TouchableOpacity
            onPress={handleClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
            style={styles.clearBtn}
          >
            <X size={14} color={colors.textTertiary} strokeWidth={2} />
          </TouchableOpacity>
        ) : null}
      </Pressable>
    )
  }
)

CompactSearchBar.displayName = 'CompactSearchBar'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 120,
    height: 34,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.smPlus,
    overflow: 'hidden'
  },
  leftSlot: {
    marginRight: sharedTokens.spacing.xsPlus,
    alignItems: 'center',
    justifyContent: 'center'
  },
  input: {
    flex: 1,
    height: 32,
    fontSize: mobileTypography.secondary.fontSize,
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false, textAlignVertical: 'center' as const }
      : { paddingTop: 0, paddingBottom: 0 })
  },
  clearBtn: {
    marginLeft: sharedTokens.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center'
  }
})
