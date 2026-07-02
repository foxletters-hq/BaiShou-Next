import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect
} from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../Modal/Modal'
import { Button } from '../Button/Button'
import { Input } from '../Input/Input'
import styles from './Dialog.module.css'

export interface ChooseOption {
  label: string
  value: string
  destructive?: boolean
  leading?: ReactNode
  centered?: boolean
}

export interface DialogContextState {
  confirm: (message: ReactNode, title?: string) => Promise<boolean>
  prompt: (
    message: ReactNode,
    defaultValue?: string,
    title?: string,
    isMultiline?: boolean
  ) => Promise<string | null>
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
  chooseOptions?: ChooseOption[]
  resolve?: (value: any) => void
}

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useTranslation()
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

  const closeAll = useCallback(() => {
    setState((prev) => {
      if (prev.resolve) {
        prev.resolve(prev.type === 'prompt' || prev.type === 'choose' ? null : false)
      }
      return { ...prev, isOpen: false }
    })
  }, [])

  useEffect(() => {
    return () => {
      if (state.isOpen && state.resolve) {
        state.resolve(
          state.type === 'prompt' || state.type === 'choose'
            ? null
            : state.type === 'confirm'
              ? false
              : undefined
        )
      }
    }
  }, [state.isOpen, state.resolve, state.type])

  const alert = useCallback((message: ReactNode, title?: string): Promise<void> => {
    return new Promise((resolve) => {
      setState({ isOpen: true, type: 'alert', message, title, resolve })
    })
  }, [])

  const confirm = useCallback((message: ReactNode, title?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ isOpen: true, type: 'confirm', message, title, resolve })
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

  const showTitle =
    state.type !== 'prompt' && state.type !== 'confirm' ? state.title : undefined

  return (
    <DialogContext.Provider value={{ alert, confirm, prompt, choose, closeAll }}>
      {children}
      {state.isOpen && (
        <Modal
          isOpen={state.isOpen}
          onClose={dismissDialog}
          title={showTitle}
          zIndex={1100}
        >
          <div className={styles.dialogContent}>
            {state.type !== 'choose' ? <div className={styles.message}>{state.message}</div> : null}

            {state.type === 'choose' &&
            typeof state.message === 'string' &&
            state.message.trim().length > 0 ? (
              <div className={styles.message}>{state.message}</div>
            ) : null}

            {state.type === 'prompt' &&
              (state.isMultiline ? (
                <textarea
                  autoFocus
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  className={styles.promptInput}
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-outline-variant)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-on-surface)',
                    marginTop: '16px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none'
                  }}
                />
              ) : (
                <Input
                  autoFocus
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') closeDialog(promptValue)
                  }}
                  className={styles.promptInput}
                />
              ))}

            {state.type === 'choose' && state.chooseOptions ? (
              <div className={styles.chooseList}>
                {state.chooseOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={[
                      styles.chooseItem,
                      opt.leading ? styles.chooseItemWithLeading : '',
                      opt.centered ? styles.chooseItemCentered : ''
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => closeDialog(opt.value)}
                  >
                    {opt.leading ? <span className={styles.chooseLeading}>{opt.leading}</span> : null}
                    <span
                      className={styles.chooseLabel}
                      style={opt.destructive ? { color: 'var(--color-error)' } : undefined}
                    >
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {state.type === 'choose' ? (
              <div className={styles.actions}>
                <Button variant="text" onClick={() => closeDialog(null)}>
                  {t('common.cancel', '取消')}
                </Button>
              </div>
            ) : (
              <div className={styles.actions}>
                {state.type !== 'alert' && (
                  <Button
                    variant="text"
                    onClick={() => closeDialog(state.type === 'prompt' ? null : false)}
                  >
                    {t('common.cancel', '取消')}
                  </Button>
                )}
                <Button
                  variant="elevated"
                  onClick={() => closeDialog(state.type === 'prompt' ? promptValue : true)}
                >
                  {t('common.confirm', '确定')}
                </Button>
              </div>
            )}
          </div>
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
