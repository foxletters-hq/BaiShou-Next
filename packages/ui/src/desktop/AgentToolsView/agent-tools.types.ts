import React from 'react'

import type { EmojiToolConfig, ToolManagementConfig } from '@baishou/shared'

export type { EmojiToolConfig, ToolManagementConfig }

export interface AgentToolsViewProps {
  config: ToolManagementConfig
  onChange: (config: ToolManagementConfig) => void
  /** 全页设置区（默认）或桌面弹窗 */
  presentation?: 'page' | 'dialog'
  /** 弹窗模式下右上角关闭 */
  onClose?: () => void
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