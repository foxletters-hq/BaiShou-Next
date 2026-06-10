import React from 'react'
import { TextInput, type StyleProp, type TextStyle } from 'react-native'
import { useNativeTheme } from '../theme'
import { chatBubbleStyles as styles } from './chat-bubble.styles'

export interface NativeChatBubbleInlineEditorProps {
  value: string
  onChangeText: (text: string) => void
  inputRef?: React.Ref<any>
  autoFocus?: boolean
  style?: StyleProp<TextStyle>
}

/** 聊天气泡内联编辑：原生 TextInput，支持多行滚动 */
export const NativeChatBubbleInlineEditor: React.FC<NativeChatBubbleInlineEditorProps> = ({
  value,
  onChangeText,
  inputRef,
  autoFocus = true,
  style
}) => {
  const { colors } = useNativeTheme()

  return (
    <TextInput
      ref={inputRef}
      style={[styles.editInput, { color: colors.textPrimary }, style]}
      value={value}
      onChangeText={onChangeText}
      multiline
      scrollEnabled
      textAlignVertical="top"
      autoFocus={autoFocus}
      underlineColorAndroid="transparent"
    />
  )
}
