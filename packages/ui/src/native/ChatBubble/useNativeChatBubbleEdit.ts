import { useState, useRef } from 'react'
import type { TextInput } from 'react-native'

export function useNativeChatBubbleEdit(
  initialContent: string,
  onSaveEdit?: (content: string) => void,
  onResendEdit?: (content: string) => void
) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(initialContent)
  const editInputRef = useRef<TextInput>(null)

  const handleStartEdit = () => {
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
