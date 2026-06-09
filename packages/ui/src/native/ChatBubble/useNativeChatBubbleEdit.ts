import { useState, useRef, useEffect } from 'react'
import { Keyboard } from 'react-native'

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

  useEffect(() => {
    onEditingChange?.(isEditing, isEditing ? messageId : undefined)
    return () => {
      if (isEditing) onEditingChange?.(false, messageId)
    }
  }, [isEditing, messageId, onEditingChange])

  const handleStartEdit = () => {
    Keyboard.dismiss()
    setEditContent(initialContent)
    setIsEditing(true)
  }

  const handleSaveEdit = () => {
    if (editContent.trim()) {
      onSaveEdit?.(editContent.trim())
      setIsEditing(false)
    }
  }

  const handleResendEdit = () => {
    if (editContent.trim()) {
      onResendEdit?.(editContent.trim())
      setIsEditing(false)
    }
  }

  const handleCancelEdit = () => {
    setEditContent(initialContent)
    setIsEditing(false)
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
