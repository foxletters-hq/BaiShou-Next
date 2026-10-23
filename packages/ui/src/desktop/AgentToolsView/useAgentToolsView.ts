import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { isEnablingAutoInjectTime, type AgentToolScene } from '@baishou/shared'
import { useDialog } from '../Dialog'
import type { AgentToolDef, AgentToolsConfig, ToolConfigParam } from './agent-tools.types'
import {
  AGENT_TOOL_CATEGORY_ORDER,
  WORKSPACE_TOOL_CATEGORY_ORDER,
  buildAgentTools,
  buildCategoryMeta,
  buildWorkspaceCategoryMeta,
  buildWorkspaceTools
} from './agent-tools.constants'

interface UseAgentToolsViewOptions {
  config: AgentToolsConfig
  onChange: (config: AgentToolsConfig) => void
  scene?: AgentToolScene
}

export function useAgentToolsView({
  config,
  onChange,
  scene = 'companion'
}: UseAgentToolsViewOptions) {
  const { t } = useTranslation()
  const dialog = useDialog()

  const allTools = useMemo(
    () => (scene === 'workspace' ? buildWorkspaceTools(t) : buildAgentTools(t)),
    [scene, t]
  )
  const categoryMeta = useMemo(
    () => (scene === 'workspace' ? buildWorkspaceCategoryMeta(t) : buildCategoryMeta(t)),
    [scene, t]
  )
  const categoryOrder =
    scene === 'workspace' ? WORKSPACE_TOOL_CATEGORY_ORDER : AGENT_TOOL_CATEGORY_ORDER

  const toggleTool = async (toolId: string) => {
    const disabledList = Array.isArray(config.disabledToolIds) ? [...config.disabledToolIds] : []
    const isCurrentlyEnabled = !disabledList.includes(toolId)

    if (isCurrentlyEnabled) {
      disabledList.push(toolId)
    } else {
      if (isEnablingAutoInjectTime(toolId, false)) {
        const confirmed = await dialog.confirm(
          t(
            'agent.tools.auto_inject_time_enable_confirm',
            '开启后，发送给伙伴的每条历史消息都会带上发送时间标签。部分模型可能把这些标签抄进回复，聊天气泡里会出现类似 <message-time> 的文字。确定开启？'
          ),
          t('agent.tools.auto_inject_time_enable_confirm_title', '开启当前时间？')
        )
        if (!confirmed) return
      }
      const idx = disabledList.indexOf(toolId)
      if (idx > -1) disabledList.splice(idx, 1)
    }
    onChange({ ...config, disabledToolIds: disabledList })
  }

  const setToolParam = (toolId: string, key: string, value: unknown) => {
    const customConfigs = { ...(config.customConfigs || {}) }
    if (!customConfigs[toolId]) {
      customConfigs[toolId] = {}
    }
    customConfigs[toolId] = { ...customConfigs[toolId], [key]: value }
    onChange({ ...config, customConfigs })
  }

  const getToolParam = (toolId: string, param: ToolConfigParam) => {
    const customConfigs = config.customConfigs || {}
    if (customConfigs[toolId] && customConfigs[toolId][param.key] !== undefined) {
      return customConfigs[toolId][param.key]
    }
    return param.defaultValue
  }

  const groupedTools = allTools.reduce(
    (acc, tool) => {
      if (!acc[tool.category]) acc[tool.category] = []
      acc[tool.category].push(tool)
      return acc
    },
    {} as Record<string, AgentToolDef[]>
  )

  return {
    allTools,
    categoryMeta,
    categoryOrder,
    groupedTools,
    toggleTool,
    setToolParam,
    getToolParam,
    showEmojiTools: scene === 'companion'
  }
}
