import type { ReactNode } from 'react'
import type { MockChatAttachment } from '@baishou/shared'
import type { PromptShortcut } from '../PromptShortcutSheet'
import type { ComposerDraftStorage, ComposerOnSend } from '../../shared/composer-draft'

export interface InputBarProps {
  isLoading: boolean
  /** 流式中仍允许发送（工作台 steer/queue） */
  allowSendWhileLoading?: boolean
  onSend: ComposerOnSend
  onStop?: () => void
  composerBlocked?: boolean
  onComposerBlocked?: () => void
  composerDraftKey?: string
  composerDraftStorage?: ComposerDraftStorage
  assistantName?: string
  onAssistantTap?: () => void
  onRecall?: () => void
  /** 传入后启用空输入框 `/` Skill 匹配；未传时 `/` 可回退到 onTriggerShortcut */
  shortcuts?: PromptShortcut[]
  onTriggerShortcut?: () => void
  /** 打开 Skill 管理（原快捷指令管理） */
  onManageShortcuts?: () => void
  onOpenTools?: () => void
  searchMode?: boolean
  onToggleSearchMode?: () => void
  ttsMode?: 'always' | 'manual'
  onToggleTtsMode?: () => void
  /** 传入后在加号菜单中增加「笔记本挂载」入口 */
  onOpenNotebookMount?: () => void
  /** 覆盖默认输入框占位文案 */
  placeholder?: string
  /** 底部右侧发送按钮左侧的附加控件（如模型选择） */
  bottomTrailing?: ReactNode
  /** 输入外壳底部延伸区 */
  footer?: ReactNode
  /** 发送按钮内纸飞机图标尺寸；按钮外框尺寸不变（默认 15） */
  sendIconSize?: number
  /** 文本区最少显示行数（默认 1） */
  minRows?: number
}

export interface InputBarRef {
  insertText: (text: string) => void
  /** 整段替换输入框内容（草稿恢复 / 回滚回填） */
  setText: (text: string) => void
  /** 回填纯文案，并按需恢复 Skill 引用胶囊 */
  restoreDraft: (draft: {
    text: string
    skillRefs?: Array<{ command: string; content: string }>
  }) => void
  /** 插入快捷指令正文并自动换行（遗留）；Skill 请用 applySkillRef */
  insertShortcutContent: (content: string) => void
  /** 以输入框内引用胶囊挂载 Skill（发送时再展开正文） */
  applySkillRef: (skill: { command?: string; name?: string; id?: string; content: string }) => void
  focus: () => void
}
