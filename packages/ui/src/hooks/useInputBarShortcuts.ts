import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import type { PromptShortcut } from '@baishou/shared'
import {
  appendShortcutInsertText,
  filterShortcutsByQuery,
  getShortcutQuery,
  shouldStartShortcutSession
} from '@baishou/shared'

export function useInputBarShortcuts(
  text: string,
  setText: React.Dispatch<React.SetStateAction<string>>,
  shortcuts: PromptShortcut[] | undefined
) {
  const slashSessionRef = useRef(false)
  const [shortcutModeActive, setShortcutModeActive] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const query = getShortcutQuery(text)
  const filteredShortcuts = useMemo(() => {
    if (!shortcutModeActive || !shortcuts?.length) return []
    return filterShortcutsByQuery(shortcuts, query)
  }, [shortcutModeActive, shortcuts, query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!text.startsWith('/')) {
      slashSessionRef.current = false
      setShortcutModeActive(false)
    }
  }, [text])

  const applyShortcut = useCallback(
    (shortcut: PromptShortcut) => {
      setText((prev) => {
        const base = prev.startsWith('/') ? '' : prev
        return appendShortcutInsertText(base, shortcut.content)
      })
      slashSessionRef.current = false
      setShortcutModeActive(false)
      setSelectedIndex(0)
    },
    [setText]
  )

  const handleTextChangeForShortcuts = useCallback(
    (prevText: string, nextText: string) => {
      if (!shortcuts?.length) return

      if (shouldStartShortcutSession(prevText, nextText)) {
        slashSessionRef.current = true
        setShortcutModeActive(true)
        setSelectedIndex(0)
        return
      }

      if (slashSessionRef.current && nextText.startsWith('/')) {
        setShortcutModeActive(true)
      }
    },
    [shortcuts]
  )

  const clearShortcutSession = useCallback(() => {
    setText('')
    slashSessionRef.current = false
    setShortcutModeActive(false)
  }, [setText])

  const moveShortcutSelection = useCallback(
    (delta: -1 | 1) => {
      if (!filteredShortcuts.length) return
      setSelectedIndex((index) =>
        delta < 0 ? Math.max(index - 1, 0) : Math.min(index + 1, filteredShortcuts.length - 1)
      )
    },
    [filteredShortcuts.length]
  )

  const submitSelectedShortcut = useCallback(() => {
    const picked = filteredShortcuts[selectedIndex]
    if (picked) applyShortcut(picked)
  }, [applyShortcut, filteredShortcuts, selectedIndex])

  const tryHandleShortcutKey = useCallback(
    (key: string, shiftKey = false): boolean => {
      if (!shortcutModeActive || !text.startsWith('/')) return false

      if (key === 'ArrowDown' && filteredShortcuts.length > 0) {
        moveShortcutSelection(1)
        return true
      }

      if (key === 'ArrowUp' && filteredShortcuts.length > 0) {
        moveShortcutSelection(-1)
        return true
      }

      if (key === 'Escape') {
        clearShortcutSession()
        return true
      }

      if ((key === 'Enter' || key === 'Tab') && !shiftKey) {
        submitSelectedShortcut()
        return true
      }

      return false
    },
    [
      shortcutModeActive,
      text,
      filteredShortcuts.length,
      moveShortcutSelection,
      clearShortcutSession,
      submitSelectedShortcut
    ]
  )

  const handleShortcutKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      const handled = tryHandleShortcutKey(e.key, e.shiftKey)
      if (handled) e.preventDefault()
      return handled
    },
    [tryHandleShortcutKey]
  )

  const insertShortcutContent = useCallback(
    (content: string) => {
      setText((prev) => appendShortcutInsertText(prev, content))
      slashSessionRef.current = false
      setShortcutModeActive(false)
      setSelectedIndex(0)
    },
    [setText]
  )

  return {
    shortcutModeActive,
    filteredShortcuts,
    selectedIndex,
    applyShortcut,
    handleTextChangeForShortcuts,
    handleShortcutKeyDown,
    tryHandleShortcutKey,
    insertShortcutContent
  }
}
