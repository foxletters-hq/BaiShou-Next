import { useState, useRef, useEffect, useCallback } from 'react'
import { InteractionManager, Keyboard, LayoutAnimation, Platform, UIManager } from 'react-native'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

function configureEditExitAnimation(): void {
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      250,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity
    )
  )
}

export function useNativeChatBubbleEdit(
  initialContent: string,
  messageId: string | undefined,
  onSaveEdit?: (content: string) => void,
  onResendEdit?: (content: string) => void,
  onEditingChange?: (editing: boolean, messageId?: string) => void
) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(initialContent)
  const editInputRef = useRef<any>(null)
  const isEditingRef = useRef(isEditing)
  isEditingRef.current = isEditing

  useEffect(() => {
    return () => {
      if (isEditingRef.current) {
        onEditingChange?.(false, messageId)
      }
    }
  }, [messageId, onEditingChange])

  useEffect(() => {
    if (!isEditing) return
    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        editInputRef.current?.focus()
      })
    })
    return () => task.cancel()
  }, [isEditing])

  const handleStartEdit = () => {
    setEditContent(initialContent)
    setIsEditing(true)
    onEditingChange?.(true, messageId)
  }

  const endEditing = useCallback(() => {
    configureEditExitAnimation()
    editInputRef.current?.blur()
    Keyboard.dismiss()
    setIsEditing(false)
    onEditingChange?.(false, messageId)
  }, [messageId, onEditingChange])

  const handleSaveEdit = () => {
    if (editContent.trim()) {
      onSaveEdit?.(editContent.trim())
      endEditing()
    }
  }

  const handleResendEdit = () => {
    if (editContent.trim()) {
      onResendEdit?.(editContent.trim())
      endEditing()
    }
  }

  const handleCancelEdit = () => {
    setEditContent(initialContent)
    endEditing()
  }

  return {
    isEditing,
    editContent,
    setEditContent,
    editInputRef,
    handleStartEdit,
    handleSaveEdit,
    handleResendEdit,
    handleCancelEdit
  }
}
