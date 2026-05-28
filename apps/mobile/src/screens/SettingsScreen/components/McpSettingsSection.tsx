import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native'
import { useTranslation } from 'react-i18next'
import * as Clipboard from 'expo-clipboard'
import * as Network from 'expo-network'
import { useNativeTheme } from '@baishou/ui/native'
import type { McpServerConfig } from '@baishou/shared'
import { useBaishou } from '../../../providers/BaishouProvider'

const DEFAULT_MCP_CONFIG: McpServerConfig = {
  mcpEnabled: false,
  mcpPort: 31004
}

export const McpSettingsSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { services, dbReady } = useBaishou()

  const [config, setConfig] = useState<McpServerConfig>(DEFAULT_MCP_CONFIG)
  const [deviceIp, setDeviceIp] = useState<string>('127.0.0.1')
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    if (!dbReady || !services) return
    const load = async () => {
      try {
        const saved =
          (await services.settingsManager.get<McpServerConfig>('mcp_server_config')) ||
          DEFAULT_MCP_CONFIG
        setConfig(saved)
        const ip = await Network.getIpAddressAsync()
        if (ip && ip !== '0.0.0.0') setDeviceIp(ip)
      } catch (e) {
        console.warn('Load MCP config failed', e)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [dbReady, services])

  const mcpEndpointUrl = `http://${deviceIp}:${config.mcpPort}/mcp`

  const persistConfig = async (next: McpServerConfig) => {
    if (!services || !dbReady) return
    setApplying(true)
    try {
      await services.settingsManager.set('mcp_server_config', next)
      setConfig(next)
      await services.mobileMcpService.applyConfig(next)
      Alert.alert(t('common.success'), t('settings.mcp_saved'))
    } catch (e) {
      console.error(e)
      Alert.alert(t('common.error'), t('common.errors.save_failed'))
    } finally {
      setApplying(false)
    }
  }

  const handleCopyEndpoint = async () => {
    try {
      await Clipboard.setStringAsync(mcpEndpointUrl)
      Alert.alert(t('common.success'), t('common.copied'))
    } catch {
      Alert.alert(t('common.error'), t('common.copy_failed'))
    }
  }

  const showToolsAlert = () => {
    const tools = services?.mobileMcpService.getToolsList() || []
    if (tools.length === 0) {
      Alert.alert(
        t('settings.mcp_tools_list'),
        t('settings.mcp_no_tools')
      )
      return
    }

    const lines = tools.map((tool) => {
      const cleanName = tool.displayName || tool.name.replace(/^baishou_/, '')
      const localizedTitle = t(`agent.tools.${cleanName}`, cleanName)
      const localizedDesc = t(`agent.tools.${cleanName}_desc`, tool.description)
      return `• ${tool.name} (${localizedTitle})\n  ${localizedDesc}`
    })

    Alert.alert(t('settings.mcp_tools_list'), lines.join('\n\n'))
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {t('settings.mcp_title')}
      </Text>
      <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
        {t('settings.tooltip_mcp_server')}
      </Text>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
          {t('settings.mcp_enable')}
        </Text>
        <Switch
          value={config.mcpEnabled}
          disabled={applying}
          onValueChange={(value) => void persistConfig({ ...config, mcpEnabled: value })}
        />
      </View>

      <TouchableOpacity
        style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}
        onPress={showToolsAlert}
      >
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
          {t('settings.mcp_view_tools')}
        </Text>
        <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
          {t('settings.mcp_view_tools_desc')}
        </Text>
      </TouchableOpacity>

      {config.mcpEnabled && (
        <>
          <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
              {t('settings.mcp_port')}
            </Text>
            <TextInput
              style={[
                styles.portInput,
                {
                  color: colors.textPrimary,
                  borderColor: colors.borderSubtle,
                  backgroundColor: colors.bgSurface
                }
              ]}
              keyboardType="number-pad"
              value={String(config.mcpPort)}
              onChangeText={(text) => {
                const val = parseInt(text, 10)
                if (!isNaN(val)) setConfig({ ...config, mcpPort: val })
              }}
              onBlur={() => {
                const port = Math.min(65535, Math.max(1000, config.mcpPort || 31004))
                void persistConfig({ ...config, mcpPort: port })
              }}
            />
          </View>

          <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
              {t('settings.mcp_endpoint')}
            </Text>
            <Text style={[styles.endpointUrl, { color: colors.primary }]} selectable>
              {mcpEndpointUrl}
            </Text>
            <TouchableOpacity
              style={[styles.copyBtn, { backgroundColor: colors.primary }]}
              onPress={() => void handleCopyEndpoint()}
            >
              <Text style={[styles.copyBtnText, { color: colors.textOnPrimary }]}>
                {t('settings.mcp_copy_url')}
              </Text>
            </TouchableOpacity>
            {services?.mobileMcpService.isServerRunning() && (
              <Text style={[styles.runningHint, { color: colors.textSecondary }]}>
                {t('settings.mcp_running').replace(
                  '$port',
                  String(services.mobileMcpService.getActivePort())
                )}
              </Text>
            )}
          </View>
        </>
      )}

      {applying && (
        <ActivityIndicator style={styles.applySpinner} color={colors.primary} size="small" />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24
  },
  loadingWrap: {
    padding: 24,
    alignItems: 'center'
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12
  },
  settingItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  settingSub: {
    fontSize: 13,
    lineHeight: 18
  },
  portInput: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16
  },
  endpointUrl: {
    fontSize: 13,
    fontFamily: 'monospace',
    marginTop: 8,
    marginBottom: 12
  },
  copyBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  copyBtnText: {
    fontSize: 13,
    fontWeight: '600'
  },
  runningHint: {
    marginTop: 8,
    fontSize: 12
  },
  applySpinner: {
    marginTop: 8
  }
})
