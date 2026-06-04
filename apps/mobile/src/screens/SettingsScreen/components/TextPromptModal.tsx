import React, { useEffect, useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform
} from 'react-native'
import { useNativeTheme } from '@baishou/ui/native'

export interface TextPromptModalProps {
  visible: boolean
  title: string
  message?: string
  defaultValue?: string
  placeholder?: string
  confirmLabel: string
  cancelLabel: string
  multiline?: boolean
  secureTextEntry?: boolean
  onCancel: () => void
  onConfirm: (value: string) => void
}

export const TextPromptModal: React.FC<TextPromptModalProps> = ({
  visible,
  title,
  message,
  defaultValue = '',
  placeholder,
  confirmLabel,
  cancelLabel,
  multiline = false,
  secureTextEntry = false,
  onCancel,
  onConfirm
}) => {
  const { colors, tokens } = useNativeTheme()
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    if (visible) setValue(defaultValue)
  }, [visible, defaultValue])

  if (!visible) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.bgSurface,
              borderRadius: tokens.radius.xl,
              padding: tokens.spacing.lg
            }
          ]}
        >
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          ) : null}
          <TextInput
            style={[
              styles.input,
              multiline && styles.inputMultiline,
              {
                color: colors.textPrimary,
                borderColor: colors.borderSubtle,
                backgroundColor: colors.bgApp
              }
            ]}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            multiline={multiline}
            secureTextEntry={secureTextEntry}
            autoFocus
          />
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.actionBtn}>
              <Text style={{ color: colors.textSecondary }}>{cancelLabel}</Text>
            </Pressable>
            <Pressable onPress={() => onConfirm(value)} style={styles.actionBtn}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center'
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 16
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top'
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4
  }
})
