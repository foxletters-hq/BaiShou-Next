import React from 'react'

import type {
  AgentToolScene,
  EmojiToolConfig,
  ToolManagementConfig,
  WorkspaceToolManagementConfig
} from '@baishou/shared'

export type { AgentToolScene, EmojiToolConfig, ToolManagementConfig, WorkspaceToolManagementConfig }

export type AgentToolsConfig = ToolManagementConfig | WorkspaceToolManagementConfig

export interface AgentToolsViewProps {
  config: AgentToolsConfig
  onChange: (config: AgentToolsConfig) => void
  /** 伙伴或工作台工具目录 */
  scene?: AgentToolScene
  /** 全页设置区（默认）或桌面弹窗 */
  presentation?: 'page' | 'dialog'
  /** 弹窗模式下右上角关闭 */
  onClose?: () => void
  /** 进入表情包等子页时通知外层隐藏分段顶栏 */
  onSubpageActiveChange?: (active: boolean) => void
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
  /** 为 false 时开关固定开启且不可关闭（与 registry 中 canBeDisabled 一致） */
  canBeDisabled?: boolean
}
