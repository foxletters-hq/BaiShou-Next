import React, { forwardRef, useCallback } from 'react'
import {
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type TargetedEvent,
  type TextStyle,
  type ViewStyle
} from 'react-native'
import {
  Input as HeroInput,
  TextArea as HeroTextArea,
  TextField,
  Label,
  Description,
  FieldError,
  cn,
  type InputProps as HeroInputProps
} from 'heroui-native'
import { useNativeTheme } from '../theme'
import { useKeyboardAwareScroll } from '../KeyboardAwareScrollView/keyboard-aware-scroll.context'
import { scheduleScrollFocusedInputOnFocus } from '../KeyboardAwareScrollView/schedule-scroll-on-focus.util'
import { sanitizeHeroInputStyle, splitInputLayoutStyle } from './input-style.utils'
import {
  getCompactTextFieldStyle,
  getHeroInputFieldStyle,
  isCompactInputStyle
} from './input-field.styles'

export interface NativeInputProps extends Omit<HeroInputProps, 'children'> {
  label?: string
  error?: string
  helperText?: string
  containerStyle?: StyleProp<ViewStyle>
  leftSlot?: React.ReactNode
  rightSlot?: React.ReactNode
  /**
   * 使用 HeroUI TextArea（默认 h-32，适合表单长文本）。
   * 为 false 时 multiline 仍走 Input + rounded-2xl（适合聊天栏等）。
   */
  textarea?: boolean
  /** Tailwind/NativeWind classes merged with HeroUI field styles */
  className?: string
  /**
   * 聚焦时自动滚入键盘安全区（需外层 `KeyboardAwareScrollView`）。
   * 聊天栏等固定底栏场景可设为 false。
   */
  keyboardAware?: boolean
}

/**
 * 统一的白守 Input —— TextField + Input，并带 RN 场域样式兜底（不依赖 Uniwind）。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Input = forwardRef<any, NativeInputProps>(
  (
    {
      label,
      error,
      helperText,
      containerStyle,
      leftSlot,
      rightSlot,
      isInvalid,
      multiline,
      textarea = false,
      style,
      className,
      textAlignVertical: textAlignVerticalProp,
      keyboardAware = true,
      onFocus,
      placeholderTextColor,
      selectionColor,
      ...props
    },
    ref
  ) => {
    const { colors } = useNativeTheme()
    const keyboardScroll = useKeyboardAwareScroll()

    const handleFocus = useCallback(
      (event: NativeSyntheticEvent<TargetedEvent>) => {
        onFocus?.(event)
        if (!keyboardAware || !keyboardScroll) return
        scheduleScrollFocusedInputOnFocus(keyboardScroll.scrollFocusedIntoView)
      },
      [keyboardAware, keyboardScroll, onFocus]
    )
    const resolvedPlaceholderColor = placeholderTextColor ?? colors.textTertiary
    const resolvedSelectionColor = selectionColor ?? colors.primary
    const computedInvalid = isInvalid ?? !!error
    const useTextArea = textarea && multiline
    const hasSlots = Boolean(leftSlot || rightSlot)
    const sanitizedStyle = sanitizeHeroInputStyle(style)
    const { inputStyle: layoutInputStyle, wrapperStyle: slotWrapperStyle } = hasSlots
      ? splitInputLayoutStyle(sanitizedStyle)
      : { inputStyle: sanitizedStyle, wrapperStyle: undefined }
    const compact = isCompactInputStyle(style)
    const fieldShell = getHeroInputFieldStyle(colors, {
      multiline: useTextArea || multiline,
      compact
    })
    const textFieldLayout = getCompactTextFieldStyle(style)

    const inputClassName = cn(!compact && 'w-full', className)

    const inputStyle: StyleProp<TextStyle> = [
      fieldShell,
      leftSlot ? { paddingLeft: 40 } : null,
      rightSlot ? { paddingRight: 48 } : null,
      layoutInputStyle
    ]

    const inputNode = useTextArea ? (
      <HeroTextArea
        ref={ref}
        isInvalid={computedInvalid}
        variant="primary"
        className={inputClassName}
        style={inputStyle}
        placeholderTextColor={resolvedPlaceholderColor}
        selectionColor={resolvedSelectionColor}
        selectionColorClassName="accent-primary"
        onFocus={handleFocus}
        {...props}
      />
    ) : (
      <HeroInput
        ref={ref}
        isInvalid={computedInvalid}
        variant="primary"
        multiline={multiline}
        textAlignVertical={textAlignVerticalProp ?? (multiline ? 'top' : 'center')}
        className={inputClassName}
        style={inputStyle}
        placeholderTextColor={resolvedPlaceholderColor}
        selectionColor={resolvedSelectionColor}
        selectionColorClassName="accent-primary"
        onFocus={handleFocus}
        {...props}
      />
    )

    const slotOverlayStyle = {
      position: 'absolute' as const,
      top: 0,
      bottom: 0,
      justifyContent: 'center' as const,
      alignItems: 'center' as const
    }

    const inputWithSlots = hasSlots ? (
      <View style={[{ position: 'relative' }, slotWrapperStyle]}>
        {inputNode}
        {leftSlot ? (
          <View pointerEvents="box-none" style={[slotOverlayStyle, { left: 12, width: 28 }]}>
            {leftSlot}
          </View>
        ) : null}
        {rightSlot ? (
          <View
            pointerEvents="box-none"
            style={[slotOverlayStyle, { right: 4, width: 44, overflow: 'visible' }]}
          >
            {rightSlot}
          </View>
        ) : null}
      </View>
    ) : (
      inputNode
    )

    const textFieldNode = (
      <TextField isInvalid={computedInvalid} className="gap-1.5" style={textFieldLayout}>
        {label ? <Label>{label}</Label> : null}
        {inputWithSlots}
        {error ? (
          <FieldError>{error}</FieldError>
        ) : helperText ? (
          <Description>{helperText}</Description>
        ) : null}
      </TextField>
    )

    const hasChrome = label || error || helperText || containerStyle

    if (!hasChrome) {
      return textFieldNode
    }

    return (
      <View style={[{ width: compact ? undefined : '100%' }, containerStyle]}>{textFieldNode}</View>
    )
  }
)

Input.displayName = 'Input'

export {
  TextArea,
  type TextAreaProps,
  TextField,
  type TextFieldRootProps,
  Label,
  Description,
  FieldError,
  SearchField,
  useSearchField,
  useTextField
} from 'heroui-native'
