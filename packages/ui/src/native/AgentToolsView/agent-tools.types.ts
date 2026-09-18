import type { AgentGateEffect, EmojiToolConfig } from '@baishou/shared'

export interface ToolManagementConfig {
  disabledToolIds: string[]
  customConfigs: Record<string, Record<string, unknown>>
  emojiConfig?: EmojiToolConfig
}

export interface AgentToolsViewProps {
  config: ToolManagementConfig
  onChange: (config: ToolManagementConfig) => void
  /** 传入后按伙伴对话允许 / 询问 / 拒绝展示，不再只用开关 */
  resolveToolEffect?: (toolId: string) => AgentGateEffect
  onToolEffectChange?: (toolId: string, effect: AgentGateEffect) => void
  disableScroll?: boolean
  /** Mobile: pick and import emoji images via image picker */
  onPickAndImportEmojis?: () => Promise<
    { relativePath: string; originalName: string; error: string | null }[]
  >
  /** Mobile: resolve a relativePath to a displayable URI */
  onResolveEmojiPath?: (relativePath: string) => Promise<string>
  /** Mobile: delete an emoji file */
  onDeleteEmoji?: (relativePath: string) => Promise<boolean>
  /** 打开独立表情包设置页 */
  onOpenEmojiSettings?: () => void
}

export interface ToolConfigParam {
  key: string
  label: string
  type: 'integer' | 'boolean' | 'string' | 'select'
  defaultValue: unknown
  min?: number
  max?: number
  icon?: string
}

export interface AgentToolDef {
  id: string
  category: string
  name: string
  tooltipKey: string
  configurableParams?: ToolConfigParam[]
  canBeDisabled?: boolean
}
