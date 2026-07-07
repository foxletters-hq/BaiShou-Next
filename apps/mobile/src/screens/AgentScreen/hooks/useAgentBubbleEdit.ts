import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { Keyboard, Platform, Dimensions, type ScrollView, type View } from 'react-native'
import { BUBBLE_EDIT_DOCK_GAP, BUBBLE_EDIT_KEYBOARD_BUFFER } from '../agent-screen.constants'

export function useAgentBubbleEdit(deps: {
  flatListRef: RefObject<ScrollView | null>
  scrollOffsetRef: RefObject<number>
  readKeyboardInset: () => number
  tabBarHeight: number
  inputDockHeight: number
  resetKeyboardInset: () => void
  isBubbleEditing: boolean
  editingMessageId: string | null
  setIsBubbleEditing: (editing: boolean) => void
  setEditingMessageId: (messageId: string | null) => void
}) {
  const {
    flatListRef,
    scrollOffsetRef,
    readKeyboardInset,
    tabBarHeight,
    inputDockHeight,
    resetKeyboardInset,
    isBubbleEditing,
    editingMessageId,
    setIsBubbleEditing,
    setEditingMessageId
  } = deps

  const editingRowRef = useRef<View>(null)
  const preBubbleEditScrollOffsetRef = useRef<number | null>(null)
  const bubbleEditScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bubbleEditRestoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleBubbleEditingChange = useCallback(
    (editing: boolean, messageId?: string) => {
      if (editing) {
        if (bubbleEditRestoreTimerRef.current) {
          clearTimeout(bubbleEditRestoreTimerRef.current)
          bubbleEditRestoreTimerRef.current = null
        }
        preBubbleEditScrollOffsetRef.current = scrollOffsetRef.current
      }
      setIsBubbleEditing(editing)
      setEditingMessageId(editing && messageId ? messageId : null)
    },
    [scrollOffsetRef, setIsBubbleEditing, setEditingMessageId]
  )

  const restorePreBubbleEditScroll = useCallback(() => {
    const saved = preBubbleEditScrollOffsetRef.current
    if (saved == null) return

    const finishRestore = () => {
      const target = preBubbleEditScrollOffsetRef.current
      if (target == null) return
      preBubbleEditScrollOffsetRef.current = null
      flatListRef.current?.scrollTo({ y: target, animated: true })
      scrollOffsetRef.current = target
    }

    if (bubbleEditRestoreTimerRef.current) {
      clearTimeout(bubbleEditRestoreTimerRef.current)
      bubbleEditRestoreTimerRef.current = null
    }

    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    if (Keyboard.isVisible?.()) {
      const sub = Keyboard.addListener(hideEvent, () => {
        sub.remove()
        if (bubbleEditRestoreTimerRef.current) {
          clearTimeout(bubbleEditRestoreTimerRef.current)
          bubbleEditRestoreTimerRef.current = null
        }
        requestAnimationFrame(finishRestore)
      })
      bubbleEditRestoreTimerRef.current = setTimeout(() => {
        bubbleEditRestoreTimerRef.current = null
        sub.remove()
        finishRestore()
      }, 400)
      return
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(finishRestore)
    })
  }, [flatListRef, scrollOffsetRef])
  /** 按行实测位置微调滚动：键盘展开时避开键盘，收起时避开底部工具栏 */
  const scrollEditingMessageIntoView = useCallback(() => {
    if (!editingMessageId) return
    const row = editingRowRef.current
    if (!row) return

    row.measureInWindow((_x, y, _w, height) => {
      const windowHeight = Dimensions.get('window').height
      const effectiveKeyboardInset = readKeyboardInset()
      const keyboardOpen = effectiveKeyboardInset >= 60
      const safeBottom = keyboardOpen
        ? windowHeight - effectiveKeyboardInset - tabBarHeight - BUBBLE_EDIT_KEYBOARD_BUFFER
        : windowHeight - tabBarHeight - inputDockHeight - BUBBLE_EDIT_DOCK_GAP
      const rowBottom = y + height
      if (rowBottom <= safeBottom + 4) return

      flatListRef.current?.scrollTo({
        y: scrollOffsetRef.current + (rowBottom - safeBottom),
        animated: true
      })
    })
  }, [
    editingMessageId,
    readKeyboardInset,
    tabBarHeight,
    inputDockHeight,
    flatListRef,
    scrollOffsetRef
  ])

  const scheduleBubbleEditScroll = useCallback(() => {
    if (!editingMessageId) return
    if (bubbleEditScrollTimerRef.current) clearTimeout(bubbleEditScrollTimerRef.current)
    bubbleEditScrollTimerRef.current = setTimeout(
      () => {
        bubbleEditScrollTimerRef.current = null
        scrollEditingMessageIntoView()
      },
      Platform.OS === 'ios' ? 120 : 220
    )
  }, [editingMessageId, scrollEditingMessageIntoView])

  useEffect(() => {
    if (!isBubbleEditing) {
      if (bubbleEditScrollTimerRef.current) {
        clearTimeout(bubbleEditScrollTimerRef.current)
        bubbleEditScrollTimerRef.current = null
      }
      return
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const sub = Keyboard.addListener(showEvent, scheduleBubbleEditScroll)
    return () => sub.remove()
  }, [isBubbleEditing, scheduleBubbleEditScroll])

  useEffect(() => {
    if (!isBubbleEditing || !editingMessageId) return
    scheduleBubbleEditScroll()
  }, [isBubbleEditing, editingMessageId, scheduleBubbleEditScroll])

  const wasBubbleEditingRef = useRef(false)
  useEffect(() => {
    if (wasBubbleEditingRef.current && !isBubbleEditing) {
      if (Keyboard.isVisible?.() !== true) {
        resetKeyboardInset()
      }
      restorePreBubbleEditScroll()
    }
    wasBubbleEditingRef.current = isBubbleEditing
  }, [isBubbleEditing, resetKeyboardInset, restorePreBubbleEditScroll])

  useEffect(() => {
    return () => {
      if (bubbleEditRestoreTimerRef.current) {
        clearTimeout(bubbleEditRestoreTimerRef.current)
      }
    }
  }, [])
  return {
    isBubbleEditing,
    editingMessageId,
    editingRowRef,
    handleBubbleEditingChange,
    restorePreBubbleEditScroll
  }
}
