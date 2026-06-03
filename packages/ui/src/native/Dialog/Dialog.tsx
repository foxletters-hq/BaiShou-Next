import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../Modal/Modal'
import { Button } from '../Button/Button'
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView } from 'react-native'
import { useNativeTheme } from '../theme'

export interface ConfirmOptions {
  /** 对话框标题（与字符串形式的 titleOrOptions 二选一） */
  title?: string
  /** 自定义确认按钮文本 */
  confirmText?: string
  /** 自定义取消按钮文本 */
  cancelText?: string
  /** 确认按钮以危险（红色）样式展示 */
  destructive?: boolean
}

export interface ChooseOption {
  label: string
  value: string
  destructive?: boolean
}

export interface DialogContextState {
  confirm: (message: ReactNode, titleOrOptions?: string | ConfirmOptions) => Promise<boolean>
  prompt: (
    message: ReactNode,
    defaultValue?: string,
    title?: string,
    isMultiline?: boolean
  ) => Promise<string | null>
  /** 多选一（替代系统 ActionSheet / 多按钮 Alert） */
  choose: (
    title: string | undefined,
    options: ChooseOption[],
    message?: ReactNode
  ) => Promise<string | null>
  alert: (message: ReactNode, title?: string) => Promise<void>
  closeAll: () => void
}

const DialogContext = createContext<DialogContextState | null>(null)

type DialogType = 'alert' | 'confirm' | 'prompt' | 'choose'

interface DialogState {
  isOpen: boolean
  type: DialogType
  title?: string
  message: ReactNode
  defaultValue?: string
  isMultiline?: boolean
  confirmOptions?: ConfirmOptions
  chooseOptions?: ChooseOption[]
  resolve?: (value: any) => void
}

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [state, setState] = useState<DialogState>({
    isOpen: false,
    type: 'alert',
    message: ''
  })

  const [promptValue, setPromptValue] = useState('')

  const closeDialog = useCallback((returnValue?: any) => {
    setState((prev) => {
      if (prev.resolve) prev.resolve(returnValue)
      return { ...prev, isOpen: false }
    })
  }, [])

  const closeAll = useCallback(() => {
    setState((prev) => {
      if (prev.resolve) {
        prev.resolve(prev.type === 'prompt' || prev.type === 'choose' ? null : false)
      }
      return { ...prev, isOpen: false }
    })
  }, [])

  const dismissDialog = useCallback(() => {
    setState((prev) => {
      if (!prev.isOpen) return prev
      if (prev.resolve) {
        if (prev.type === 'prompt' || prev.type === 'choose') prev.resolve(null)
        else if (prev.type === 'confirm') prev.resolve(false)
        else prev.resolve(undefined)
      }
      return { ...prev, isOpen: false }
    })
  }, [])

  const alert = useCallback((message: ReactNode, title?: string): Promise<void> => {
    return new Promise((resolve) => {
      setState({ isOpen: true, type: 'alert', message, title, resolve })
    })
  }, [])

  const choose = useCallback(
    (
      title: string | undefined,
      options: ChooseOption[],
      message?: ReactNode
    ): Promise<string | null> => {
      return new Promise((resolve) => {
        setState({
          isOpen: true,
          type: 'choose',
          title,
          message: message ?? '',
          chooseOptions: options,
          resolve
        })
      })
    },
    []
  )

  const confirm = useCallback(
    (message: ReactNode, titleOrOptions?: string | ConfirmOptions): Promise<boolean> => {
      const isOptions = typeof titleOrOptions === 'object' && titleOrOptions !== null
      const options = isOptions ? (titleOrOptions as ConfirmOptions) : undefined
      const title = isOptions
        ? options?.title
        : (titleOrOptions as string | undefined)
      return new Promise((resolve) => {
        setState({ isOpen: true, type: 'confirm', message, title, confirmOptions: options, resolve })
      })
    },
    []
  )

  const prompt = useCallback(
    (
      message: ReactNode,
      defaultValue?: string,
      title?: string,
      isMultiline?: boolean
    ): Promise<string | null> => {
      return new Promise((resolve) => {
        setPromptValue(defaultValue || '')
        setState({
          isOpen: true,
          type: 'prompt',
          message,
          title,
          defaultValue,
          isMultiline,
          resolve
        })
      })
    },
    []
  )

  const renderMessage = () => {
    if (typeof state.message === 'string') {
      return (
        <Text
          style={{
            fontSize: 15,
            color: colors.textPrimary,
            marginBottom: tokens.spacing.sm,
            lineHeight: 22
          }}
        >
          {state.message}
        </Text>
      )
    }
    return state.message
  }

  return (
    <DialogContext.Provider value={{ alert, confirm, prompt, choose, closeAll }}>
      {children}
      {state.isOpen && (
        <Modal
          visible={state.isOpen}
          onClose={dismissDialog}
          title={state.title}
        >
          <View style={styles.dialogBody}>
            {renderMessage()}

            {state.type === 'choose' && state.chooseOptions && (
              <ScrollView style={styles.chooseList} keyboardShouldPersistTaps="handled">
                {state.chooseOptions.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => closeDialog(opt.value)}
                    style={({ pressed }) => [
                      styles.chooseItem,
                      {
                        backgroundColor: pressed ? colors.bgSurfaceNormal : 'transparent',
                        borderColor: colors.borderSubtle
                      }
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '500',
                        color: opt.destructive ? colors.error : colors.textPrimary,
                        textAlign: 'center'
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {state.type === 'prompt' && (
              <TextInput
                autoFocus
                value={promptValue}
                onChangeText={setPromptValue}
                multiline={state.isMultiline}
                numberOfLines={state.isMultiline ? 4 : 1}
                style={{
                  borderWidth: 1,
                  borderColor: colors.outlineVariant,
                  borderRadius: tokens.radius.md,
                  paddingHorizontal: 12,
                  paddingVertical: state.isMultiline ? 10 : 8,
                  backgroundColor: colors.bgSurface,
                  color: colors.textPrimary,
                  fontSize: 16,
                  marginTop: tokens.spacing.sm,
                  minHeight: state.isMultiline ? 96 : 40,
                  textAlignVertical: state.isMultiline ? 'top' : 'center'
                }}
                placeholderTextColor={colors.textTertiary}
              />
            )}

            {state.type !== 'choose' && (
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  gap: tokens.spacing.sm,
                  marginTop: tokens.spacing.md
                }}
              >
                {state.type !== 'alert' && (
                  <Button
                    variant="text"
                    onPress={() => closeDialog(state.type === 'prompt' ? null : false)}
                  >
                    {state.confirmOptions?.cancelText ?? t('common.cancel', '取消')}
                  </Button>
                )}
                <Button
                  variant="elevated"
                  onPress={() => closeDialog(state.type === 'prompt' ? promptValue : true)}
                  destructive={state.confirmOptions?.destructive}
                >
                  {state.confirmOptions?.confirmText ?? t('common.confirm', '确定')}
                </Button>
              </View>
            )}

            {state.type === 'choose' && (
              <View style={{ marginTop: tokens.spacing.md }}>
                <Button variant="text" onPress={() => closeDialog(null)}>
                  {t('common.cancel', '取消')}
                </Button>
              </View>
            )}
          </View>
        </Modal>
      )}
    </DialogContext.Provider>
  )
}

export const useDialog = (): DialogContextState => {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider')
  }
  return context
}

const styles = StyleSheet.create({
  dialogBody: {
    paddingTop: 0
  },
  chooseList: {
    maxHeight: 320,
    marginTop: 4
  },
  chooseItem: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth
  }
})
