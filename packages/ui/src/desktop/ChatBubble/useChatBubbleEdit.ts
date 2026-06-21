import { useState, useRef, useCallback, useEffect } from 'react'

export function useChatBubbleEdit(
  messageContent: string,
  isUser: boolean,
  onSaveEdit?: (newContent: string) => void,
  onResendEdit?: (newContent: string) => void
) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const ta = textareaRef.current
      ta.focus()
      ta.setSelectionRange(ta.value.length, ta.value.length)
      ta.scrollTop = ta.scrollHeight
    }
  }, [isEditing])

  const handleStartEdit = useCallback(() => {
    setEditedContent(messageContent || '')
    setIsEditing(true)
  }, [messageContent])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditedContent('')
  }, [])

  const handleSaveEdit = useCallback(() => {
    onSaveEdit?.(editedContent)
    setIsEditing(false)
  }, [onSaveEdit, editedContent])

  const handleResendEdit = useCallback(() => {
    onResendEdit?.(editedContent)
    setIsEditing(false)
  }, [onResendEdit, editedContent])

  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancelEdit()
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (isUser && onResendEdit) {
          handleResendEdit()
        } else {
          handleSaveEdit()
        }
      }
    },
    [handleCancelEdit, handleSaveEdit, handleResendEdit, isUser, onResendEdit]
  )

  return {
    isEditing,
    editedContent,
    setEditedContent,
    textareaRef,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleResendEdit,
    handleEditorKeyDown
  }
}
