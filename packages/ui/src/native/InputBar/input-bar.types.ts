import type { PromptShortcut } from '@baishou/shared'
import type { ComposerDraftStorage, ComposerOnSend } from '../../shared/composer-draft'

export interface InputBarProps {
  isLoading: boolean
  /** 返回 false 时保留输入内容与草稿 */
  onSend: ComposerOnSend
  onStop?: () => void
  /** 为 true 时不发送并触发 onComposerBlocked */
  composerBlocked?: boolean
  onComposerBlocked?: () => void
  /** 传入后自动持久化/恢复未发送草稿（按会话隔离） */
  composerDraftKey?: string
  composerDraftStorage?: ComposerDraftStorage
  assistantName?: string
  onAssistantTap?: () => void
  onRecall?: () => void
  onOpenNotebookMount?: () => void
  shortcuts?: PromptShortcut[]
  onTriggerShortcut?: () => void
  onManageShortcuts?: () => void
  onOpenTools?: () => void
  searchMode?: boolean
  onToggleSearchMode?: () => void
  ttsMode?: 'always' | 'manual'
  onToggleTtsMode?: () => void
  /** 输入框获得焦点时回调（用于键盘预抬，避免闪动） */
  onInputFocus?: () => void
  /** 整栏高度变化（展开/工具栏/多行）时回调，供外层列表留白跟高 */
  onHeightChange?: (height: number) => void
  /** 为 false 时禁用底部主输入框（气泡内联编辑时避免双键盘/抢焦点） */
  composerEnabled?: boolean
}

export interface InputBarRef {
  insertText: (text: string) => void
  insertShortcutContent: (content: string) => void
  focus: () => void
  blur: () => void
}
