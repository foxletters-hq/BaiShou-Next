import type { MockChatAttachment } from '@baishou/shared'
import type { PromptShortcut } from '../PromptShortcutSheet'
import type {
  ComposerDraftStorage,
  ComposerOnSend
} from '../../shared/composer-draft'

export interface InputBarProps {
  isLoading: boolean
  onSend: ComposerOnSend
  onStop?: () => void
  composerBlocked?: boolean
  onComposerBlocked?: () => void
  composerDraftKey?: string
  composerDraftStorage?: ComposerDraftStorage
  assistantName?: string
  onAssistantTap?: () => void
  onRecall?: () => void
  /** 传入后启用空输入框 `/` 快捷指令匹配；未传时 `/` 可回退到 onTriggerShortcut */
  shortcuts?: PromptShortcut[]
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
  /** 插入快捷指令正文并自动换行（用于管理面板选用） */
  insertShortcutContent: (content: string) => void
  focus: () => void
}
