import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { GitSyncConfig } from '@baishou/shared'
import { Button, Input, Switch, useNativeTheme, useNativeToast } from '@baishou/ui/native'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import {
  mobileGitGetConfig,
  mobileGitInit,
  mobileGitIsInitialized,
  mobileGitTestRemote,
  mobileGitUnsupportedAction,
  mobileGitUpdateConfig
} from '@/src/services/mobile-git-vault.service'

export function GitManagementScreen() {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const toast = useNativeToast()
  const chrome = getStackScreenChrome(colors)
  const [config, setConfig] = useState<GitSyncConfig | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [busy, setBusy] = useState(false)
  const [testResult, setTestResult] = useState('')

  const refresh = useCallback(async () => {
    setConfig(await mobileGitGetConfig())
    setInitialized(await mobileGitIsInitialized())
  }, [])

  useEffect(() => {
    void refresh().catch((error) => toast.showError(String((error as Error)?.message || error)))
  }, [refresh, toast])

  const persist = async (patch: Partial<GitSyncConfig>) => {
    const next = await mobileGitUpdateConfig(patch)
    setConfig(next)
  }

  return (
    <StackScreenLayout
      title={t('version_control.version_control', '版本控制')}
      {...chrome}
      onBack={() => router.back()}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {t(
            'version_control.mobile_hint',
            '这里管理保险库 Git 配置，不是工作台文件夹版本库。手机可以初始化空库、保存远程并探测连通；提交和推送需要桌面端的 Git 命令行。'
          )}
        </Text>
        <View style={styles.row}>
          <Text style={{ color: colors.textPrimary, flex: 1 }}>
            {t('version_control.git_enabled', '已启用')}
          </Text>
          <Switch
            value={Boolean(config?.enabled)}
            onValueChange={(value) => void persist({ enabled: value })}
          />
        </View>
        <Input
          label={t('version_control.author_name', '用户名 (user.name)')}
          value={config?.userName ?? ''}
          onChangeText={(userName) => setConfig((prev) => (prev ? { ...prev, userName } : prev))}
          onBlur={() => void persist({ userName: config?.userName })}
        />
        <Input
          label={t('version_control.author_email', '邮箱 (user.email)')}
          value={config?.userEmail ?? ''}
          onChangeText={(userEmail) => setConfig((prev) => (prev ? { ...prev, userEmail } : prev))}
          onBlur={() => void persist({ userEmail: config?.userEmail })}
        />
        <Input
          label={t('version_control.remote_url', '远程仓库地址')}
          value={config?.remote?.url ?? ''}
          autoCapitalize="none"
          onChangeText={(url) =>
            setConfig((prev) =>
              prev
                ? { ...prev, remote: { url, branch: prev.remote?.branch || 'main' } }
                : prev
            )
          }
          onBlur={() =>
            void persist({
              remote: { url: config?.remote?.url || '', branch: config?.remote?.branch || 'main' }
            })
          }
        />
        <Input
          label={t('version_control.remote_branch', '远程分支')}
          value={config?.remote?.branch ?? 'main'}
          autoCapitalize="none"
          onChangeText={(branch) =>
            setConfig((prev) =>
              prev ? { ...prev, remote: { url: prev.remote?.url || '', branch } } : prev
            )
          }
          onBlur={() =>
            void persist({
              remote: { url: config?.remote?.url || '', branch: config?.remote?.branch || 'main' }
            })
          }
        />
        <Text style={{ color: colors.textSecondary, marginVertical: 8 }}>
          {initialized
            ? t('version_control.git_status', 'Git 仓库状态')
            : t('version_control.repo_not_initialized', '仓库未初始化')}
        </Text>
        <View style={styles.actions}>
          <Button
            isDisabled={busy}
            onPress={() => {
              setBusy(true)
              void mobileGitInit()
                .then(() => refresh())
                .then(() => toast.showSuccess(t('version_control.git_init_success', 'Git 仓库初始化成功')))
                .catch((error) => toast.showError(String((error as Error)?.message || error)))
                .finally(() => setBusy(false))
            }}
          >
            {t('version_control.init_git', '初始化 Git 仓库')}
          </Button>
          <Button
            variant="outlined"
            isDisabled={busy}
            onPress={() => {
              setBusy(true)
              void mobileGitTestRemote()
                .then((result) => {
                  setTestResult(result.message)
                  if (result.ok) toast.showSuccess(result.message)
                  else toast.showError(result.message)
                })
                .finally(() => setBusy(false))
            }}
          >
            {t('version_control.test_connection', '测试连接')}
          </Button>
          <Button
            variant="outlined"
            onPress={() => {
              try {
                mobileGitUnsupportedAction()
              } catch (error) {
                toast.showInfo(error instanceof Error ? error.message : String(error))
              }
            }}
          >
            {t('version_control.commit', '提交')}
          </Button>
        </View>
        {testResult ? (
          <Text style={{ color: colors.textSecondary, marginTop: 8 }}>{testResult}</Text>
        ) : null}
      </ScrollView>
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  hint: { marginBottom: 16, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }
})
