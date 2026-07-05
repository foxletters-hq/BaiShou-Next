import React from 'react'

export interface EmojiItem {
  id: string
  name: string
  relativePath: string
}

export interface EmojiToolConfig {
  enabled: boolean
  emojis: EmojiItem[]
}

export interface ToolManagementConfig {
  disabledToolIds: string[]
  customConfigs: Record<string, Record<string, unknown>>
  emojiConfig?: EmojiToolConfig
}

export interface AgentToolsViewProps {
  config: ToolManagementConfig
  onChange: (config: ToolManagementConfig) => void
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
  icon: React.ReactNode
  tooltipKey: string
  configurableParams?: ToolConfigParam[]
}