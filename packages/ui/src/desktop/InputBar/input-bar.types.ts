import type { ReactNode } from 'react'
import type { MockChatAttachment } from '@baishou/shared'
import type { PromptShortcut } from '../PromptShortcutSheet'
import type { ComposerDraftStorage, ComposerOnSend } from '../../shared/composer-draft'

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
  /** 覆盖默认输入框占位文案 */
  placeholder?: string
  /** 底部右侧发送按钮左侧的附加控件（如模型选择） */
  bottomTrailing?: ReactNode
  /** 输入外壳底部延伸区（如工作台工作空间 / 权限选择） */
  footer?: ReactNode
  /** 发送按钮内纸飞机图标尺寸；按钮外框尺寸不变（默认 15） */
  sendIconSize?: number
  /** 文本区最少显示行数（默认 1；工作台首页可用 3） */
  minRows?: number
}

export interface InputBarRef {
  insertText: (text: string) => void
  /** 插入快捷指令正文并自动换行（用于管理面板选用） */
  insertShortcutContent: (content: string) => void
  focus: () => void
}
