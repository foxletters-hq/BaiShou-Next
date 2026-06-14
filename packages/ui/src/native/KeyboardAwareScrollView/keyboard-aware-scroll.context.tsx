import { createContext, useContext } from 'react'

export interface KeyboardAwareScrollContextValue {
  /** 将当前聚焦输入框滚入键盘上方安全区域 */
  scrollFocusedIntoView: () => void
}

export const KeyboardAwareScrollContext = createContext<KeyboardAwareScrollContextValue | null>(
  null
)

export function useKeyboardAwareScroll(): KeyboardAwareScrollContextValue | null {
  return useContext(KeyboardAwareScrollContext)
}
