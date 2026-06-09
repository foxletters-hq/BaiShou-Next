import type { MockChatAttachment } from '@baishou/shared'

export interface InputBarProps {
  isLoading: boolean
  onSend: (text: string, attachments?: MockChatAttachment[], searchMode?: boolean) => void
  onStop?: () => void
  assistantName?: string
  onAssistantTap?: () => void
  onRecall?: () => void
  onTriggerShortcut?: () => void
  onManageShortcuts?: () => void
  onOpenTools?: () => void
  searchMode?: boolean
  onToggleSearchMode?: () => void
  ttsMode?: 'always' | 'manual'
  onToggleTtsMode?: () => void
}

export interface InputBarRef {
  insertText: (text: string) => void
  focus: () => void
}
