import React, { useEffect, useState } from 'react'
import { View } from 'react-native'
import type { ToolManagementConfig } from '@baishou/shared'
import { AUTO_INJECT_TIME_TOOL_ID, normalizeToolManagementConfig } from '@baishou/shared'
import { AgentToolsView } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'

const DEFAULT_TOOL_MANAGEMENT_CONFIG: ToolManagementConfig = {
  disabledToolIds: [AUTO_INJECT_TIME_TOOL_ID],
  customConfigs: {}
}

export const AgentToolsSection: React.FC = () => {
  const { dbReady, services } = useBaishou()
  const [config, setConfig] = useState<ToolManagementConfig>(DEFAULT_TOOL_MANAGEMENT_CONFIG)

  useEffect(() => {
    if (!dbReady || !services) return
    void (async () => {
      const saved =
        (await services.settingsManager.get<ToolManagementConfig>('tool_management_config')) ??
        DEFAULT_TOOL_MANAGEMENT_CONFIG
      setConfig(
        normalizeToolManagementConfig({ ...DEFAULT_TOOL_MANAGEMENT_CONFIG, ...saved })
      )
    })()
  }, [dbReady, services])

  const persist = async (next: ToolManagementConfig) => {
    if (!services || !dbReady) return
    await services.settingsManager.set(
      'tool_management_config',
      normalizeToolManagementConfig(next)
    )
    setConfig(next)
  }

  return (
    <View style={{ flex: 1 }}>
      <AgentToolsView config={config} onChange={persist} disableScroll />
    </View>
  )
}
