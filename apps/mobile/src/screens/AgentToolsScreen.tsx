import React, { useCallback, useEffect, useState } from 'react'
import type { ToolManagementConfig } from '@baishou/shared'
import { AgentToolsView, useNativeTheme } from '@baishou/ui/native'
import { useTranslation } from 'react-i18next'
import { useBaishou } from '../providers/BaishouProvider'
import { StackScreenLayout } from '../components/StackScreenLayout'
import { getStackScreenChrome } from '../components/stackScreenChrome'

const DEFAULT_CONFIG: ToolManagementConfig = {
  disabledToolIds: [],
  customConfigs: {}
}

export const AgentToolsScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { dbReady, services } = useBaishou()
  const [config, setConfig] = useState<ToolManagementConfig>(DEFAULT_CONFIG)

  useEffect(() => {
    if (!dbReady || !services) return
    void (async () => {
      let saved =
        (await services.settingsManager.get<ToolManagementConfig>('tool_management_config')) ??
        null
      if (!saved) {
        const legacy =
          (await services.settingsManager.get<ToolManagementConfig>('tool_config')) ?? null
        if (legacy) {
          saved = legacy
          await services.settingsManager.set('tool_management_config', legacy)
        }
      }
      setConfig({ ...DEFAULT_CONFIG, ...saved })
    })()
  }, [dbReady, services])

  const persist = useCallback(
    async (next: ToolManagementConfig) => {
      setConfig(next)
      if (!services || !dbReady) return
      await services.settingsManager.set('tool_management_config', next)
    },
    [dbReady, services]
  )

  return (
    <StackScreenLayout
      title={t('settings.agent_tools_title', '工具管理')}
      {...getStackScreenChrome(colors)}
    >
      <AgentToolsView config={config} onChange={persist} />
    </StackScreenLayout>
  )
}
