import i18n from 'i18next'
import type { TFunction } from 'i18next'
import type { lightColors } from '../../theme'
import type { ContextChainTab, ContextChainTabItem } from './context-chain-dialog.types'

type ThemeColors = typeof lightColors

export function getRoleLabel(role: string, t: TFunction): string {
  switch (role) {
    case 'system':
      return t('agent.chat.role_system', '系统')
    case 'user':
      return t('agent.chat.role_user', '用户')
    case 'assistant':
      return t('agent.chat.role_assistant', 'AI 助手')
    case 'tool':
      return t('agent.chat.role_tool', '工具')
    default:
      return role
  }
}

export function getRoleColor(role: string, colors: ThemeColors): string {
  switch (role) {
    case 'user':
      return colors.primary
    case 'assistant':
      return colors.secondary
    case 'system':
      return colors.tertiary
    case 'tool':
      return colors.error
    default:
      return colors.textSecondary
  }
}

export function getLabelBadgeColor(label: string, colors: ThemeColors): string {
  switch (label) {
    case i18n.t(
      'auto.packages.ui.src.native.ContextChainDialog.context.chain.dialog.utils.L39',
      '系统提示词'
    ):
      return colors.tertiary
    case i18n.t(
      'auto.packages.ui.src.native.ContextChainDialog.context.chain.dialog.utils.L41',
      '用户'
    ):
      return colors.primary
    case i18n.t(
      'auto.packages.ui.src.native.ContextChainDialog.context.chain.dialog.utils.L43',
      'AI 思考'
    ):
      return colors.secondary
    case i18n.t(
      'auto.packages.ui.src.native.ContextChainDialog.context.chain.dialog.utils.L45',
      'AI 输出'
    ):
      return colors.secondary
    case i18n.t(
      'auto.packages.ui.src.native.ContextChainDialog.context.chain.dialog.utils.L47',
      '工具调用'
    ):
      return colors.error
    case i18n.t(
      'auto.packages.ui.src.native.ContextChainDialog.context.chain.dialog.utils.L49',
      '对话压缩'
    ):
      return colors.tertiary
    default:
      return getRoleColor(label, colors)
  }
}

export function buildContextChainTabs(
  t: TFunction,
  compressedContent?: string,
  originalContent?: string,
  systemPrompt?: string
): ContextChainTabItem[] {
  return [
    { key: 'context', label: t('agent.chat.tab_context', '上下文') },
    ...(compressedContent
      ? [
          {
            key: 'compressed' as ContextChainTab,
            label: t('agent.chat.tab_compressed', '压缩内容')
          }
        ]
      : []),
    ...(originalContent
      ? [{ key: 'original' as ContextChainTab, label: t('agent.chat.tab_original', '原文') }]
      : []),
    ...(systemPrompt
      ? [{ key: 'prompt' as ContextChainTab, label: t('agent.chat.tab_prompt', '提示词') }]
      : [])
  ]
}
