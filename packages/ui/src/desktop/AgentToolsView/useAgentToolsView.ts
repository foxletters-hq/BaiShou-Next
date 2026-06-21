import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentToolDef, ToolConfigParam, ToolManagementConfig } from './agent-tools.types'
import { buildAgentTools, buildCategoryMeta } from './agent-tools.constants'

interface UseAgentToolsViewOptions {
  config: ToolManagementConfig
  onChange: (config: ToolManagementConfig) => void
}

export function useAgentToolsView({ config, onChange }: UseAgentToolsViewOptions) {
  const { t } = useTranslation()
  const [showCommunity, setShowCommunity] = useState(false)

  const allTools = useMemo(() => buildAgentTools(t), [t])
  const categoryMeta = useMemo(() => buildCategoryMeta(t), [t])

  const toggleTool = async (toolId: string) => {
    const disabledList = Array.isArray(config.disabledToolIds) ? [...config.disabledToolIds] : []
    const isCurrentlyEnabled = !disabledList.includes(toolId)

    if (isCurrentlyEnabled) {
      disabledList.push(toolId)
    } else {
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
    showCommunity,
    setShowCommunity,
    allTools,
    categoryMeta,
    groupedTools,
    toggleTool,
    setToolParam,
    getToolParam
  }
}
