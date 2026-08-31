import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
  useMemo
} from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../Modal/Modal'
import { Input } from '../Input/Input'
import { Checkbox } from '../Checkbox/Checkbox'
import styles from './Dialog.module.css'

/** 须高于业务 Modal（如会话历史 1300），避免确认框被压在下层 */
const DIALOG_Z_INDEX = 3200

export interface ChooseOption {
  label: string
  value: string
  /** 选项下方的补充说明 */
  description?: string
  destructive?: boolean
  leading?: ReactNode
  centered?: boolean
}

export interface ConfirmWithDontAskAgainResult {
  confirmed: boolean
  dontAskAgain: boolean
}

export interface ChooseWithDontAskAgainResult {
  value: string
  dontAskAgain: boolean
}

export interface DialogContextState {
  confirm: (message: ReactNode, title?: string) => Promise<boolean>
  confirmWithDontAskAgain: (
    message: ReactNode,
    title?: string,
    dontAskAgainLabel?: string
  ) => Promise<ConfirmWithDontAskAgainResult>
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
  chooseWithDontAskAgain: (
    title: string | undefined,
    options: ChooseOption[],
    message?: ReactNode,
    dontAskAgainLabel?: string
  ) => Promise<ChooseWithDontAskAgainResult | null>
  alert: (message: ReactNode, title?: string) => Promise<void>
  closeAll: () => void
}

function hasChooseMessage(message: ReactNode): boolean {
  if (message == null || message === false) return false
  if (typeof message === 'string') return message.trim().length > 0
  return true
}

const DialogContext = createContext<DialogContextState | null>(null)

type DialogType = 'alert' | 'confirm' | 'confirmDontAsk' | 'prompt' | 'choose' | 'chooseDontAsk'

function isChooseType(type: DialogType): boolean {
  return type === 'choose' || type === 'chooseDontAsk'
}

interface DialogState {
  isOpen: boolean
  type: DialogType
  title?: string
  message: ReactNode
  defaultValue?: string
  isMultiline?: boolean
  chooseOptions?: ChooseOption[]
  dontAskAgainLabel?: string
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
  const [dontAskAgain, setDontAskAgain] = useState(false)

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
        if (prev.type === 'prompt' || isChooseType(prev.type)) prev.resolve(null)
        else if (prev.type === 'confirmDontAsk') {
          prev.resolve({ confirmed: false, dontAskAgain: false })
        } else if (prev.type === 'confirm') prev.resolve(false)
        else prev.resolve(undefined)
      }
      return { ...prev, isOpen: false }
    })
  }, [])

  const closeAll = useCallback(() => {
    setState((prev) => {
      if (!prev.isOpen && !prev.resolve) return prev
      if (prev.resolve) {
        if (prev.type === 'prompt' || isChooseType(prev.type)) prev.resolve(null)
        else if (prev.type === 'confirmDontAsk') {
          prev.resolve({ confirmed: false, dontAskAgain: false })
        } else prev.resolve(false)
      }
      return { ...prev, isOpen: false, resolve: undefined }
    })
  }, [])

  useEffect(() => {
    return () => {
      if (state.isOpen && state.resolve) {
        if (state.type === 'prompt' || isChooseType(state.type)) state.resolve(null)
        else if (state.type === 'confirmDontAsk') {
          state.resolve({ confirmed: false, dontAskAgain: false })
        } else if (state.type === 'confirm') state.resolve(false)
        else state.resolve(undefined)
      }
    }
  }, [state.isOpen, state.resolve, state.type])

  useEffect(() => {
    if (state.isOpen && state.type === 'confirmDontAsk') {
      setDontAskAgain(false)
    }
  }, [state.isOpen, state.type])

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

  const confirmWithDontAskAgain = useCallback(
    (
      message: ReactNode,
      title?: string,
      dontAskAgainLabel?: string
    ): Promise<ConfirmWithDontAskAgainResult> => {
      return new Promise((resolve) => {
        setDontAskAgain(false)
        setState({
          isOpen: true,
          type: 'confirmDontAsk',
          message,
          title,
          dontAskAgainLabel,
          resolve
        })
      })
    },
    []
  )

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

  const chooseWithDontAskAgain = useCallback(
    (
      title: string | undefined,
      options: ChooseOption[],
      message?: ReactNode,
      dontAskAgainLabel?: string
    ): Promise<ChooseWithDontAskAgainResult | null> => {
      return new Promise((resolve) => {
        setDontAskAgain(false)
        setState({
          isOpen: true,
          type: 'chooseDontAsk',
          title,
          message: message ?? '',
          chooseOptions: options,
          dontAskAgainLabel,
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

  const dialogApi = useMemo(
    () => ({
      alert,
      confirm,
      confirmWithDontAskAgain,
      prompt,
      choose,
      chooseWithDontAskAgain,
      closeAll
    }),
    [alert, confirm, confirmWithDontAskAgain, prompt, choose, chooseWithDontAskAgain, closeAll]
  )

  const inlineTitle =
    (state.type === 'confirm' ||
      state.type === 'confirmDontAsk' ||
      state.type === 'prompt' ||
      state.type === 'alert') &&
    state.title
      ? state.title
      : undefined

  const modalTitle = isChooseType(state.type) ? state.title : undefined

  return (
    <DialogContext.Provider value={dialogApi}>
      {children}
      {state.isOpen && (
        <Modal
          isOpen={state.isOpen}
          onClose={dismissDialog}
          title={modalTitle}
          zIndex={DIALOG_Z_INDEX}
          animation="fade"
        >
          <div className={styles.dialogContent}>
            {inlineTitle ? <div className={styles.title}>{inlineTitle}</div> : null}

            {!isChooseType(state.type) ? (
              <div
                className={`${styles.message} ${typeof state.message === 'string' ? styles.messagePlain : ''}`}
              >
                {state.message}
              </div>
            ) : null}

            {isChooseType(state.type) && hasChooseMessage(state.message) ? (
              <div
                className={`${styles.message} ${typeof state.message === 'string' ? styles.messagePlain : ''}`}
              >
                {state.message}
              </div>
            ) : null}

            {state.type === 'confirmDontAsk' ? (
              <label
                className={`${styles.checkboxRow} ${dontAskAgain ? styles.checkboxRowChecked : ''}`}
              >
                <Checkbox
                  checked={dontAskAgain}
                  onChange={(e) => setDontAskAgain(e.target.checked)}
                />
                <span className={styles.checkboxLabel}>
                  {state.dontAskAgainLabel || t('common.dont_ask_again', '不再提示')}
                </span>
              </label>
            ) : null}

            {state.type === 'prompt' &&
              (state.isMultiline ? (
                <textarea
                  autoFocus
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  className={`baishou-form-field ${styles.promptInput}`}
                  rows={6}
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

            {isChooseType(state.type) && state.chooseOptions ? (
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
                    onClick={() =>
                      closeDialog(
                        state.type === 'chooseDontAsk'
                          ? { value: opt.value, dontAskAgain }
                          : opt.value
                      )
                    }
                  >
                    {opt.leading ? (
                      <span className={styles.chooseLeading}>{opt.leading}</span>
                    ) : null}
                    <span className={styles.chooseItemText}>
                      <span
                        className={`${styles.chooseLabel} ${opt.destructive ? styles.chooseLabelDanger : ''}`}
                      >
                        {opt.label}
                      </span>
                      {opt.description ? (
                        <span className={styles.chooseDesc}>{opt.description}</span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {state.type === 'chooseDontAsk' ? (
              <label
                className={`${styles.checkboxRow} ${dontAskAgain ? styles.checkboxRowChecked : ''}`}
              >
                <Checkbox
                  checked={dontAskAgain}
                  onChange={(e) => setDontAskAgain(e.target.checked)}
                />
                <span className={styles.checkboxLabel}>
                  {state.dontAskAgainLabel || t('common.dont_ask_again', '不再提示')}
                </span>
              </label>
            ) : null}

            <div className={styles.actions}>
              {isChooseType(state.type) ? (
                <button type="button" className={styles.cancelBtn} onClick={() => closeDialog(null)}>
                  {t('common.cancel', '取消')}
                </button>
              ) : (
                <>
                  {state.type !== 'alert' ? (
                    <button
                      type="button"
                      className={styles.cancelBtn}
                      onClick={() =>
                        closeDialog(
                          state.type === 'prompt'
                            ? null
                            : state.type === 'confirmDontAsk'
                              ? { confirmed: false, dontAskAgain: false }
                              : false
                        )
                      }
                    >
                      {t('common.cancel', '取消')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.confirmBtn}
                    onClick={() =>
                      closeDialog(
                        state.type === 'prompt'
                          ? promptValue
                          : state.type === 'confirmDontAsk'
                            ? { confirmed: true, dontAskAgain }
                            : true
                      )
                    }
                  >
                    {t('common.confirm', '确定')}
                  </button>
                </>
              )}
            </div>
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
