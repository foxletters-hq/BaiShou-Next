import React, { useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { WebView } from 'react-native-webview'
import * as Linking from 'expo-linking'
import {
  decideHelpDocsNavigation,
  HELP_DOCS_QUICK_START_URL,
  isHelpDocsSuccessfulDocumentUrl
} from '@baishou/shared'
import { Button, useNativeTheme } from '@baishou/ui/native'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'

export function HelpDocsScreen() {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const router = useRouter()
  const chrome = getStackScreenChrome(colors)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  return (
    <StackScreenLayout
      title={t('settings.help_docs', '帮助文档')}
      {...chrome}
      onBack={() => router.back()}
      headerRight={{
        label: t('settings.help_docs_open_browser', '在浏览器中打开'),
        onPress: () => {
          void Linking.openURL(HELP_DOCS_QUICK_START_URL)
        }
      }}
      contentStyle={{ flex: 1 }}
    >
      {failed ? (
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>
            {t('settings.help_docs_load_failed', '教程页未能在应用内打开。')}
          </Text>
          <Button
            onPress={() => {
              setFailed(false)
              setReloadKey((n) => n + 1)
            }}
          >
            {t('common.retry', '重试')}
          </Button>
        </View>
      ) : (
        <WebView
          key={reloadKey}
          source={{ uri: HELP_DOCS_QUICK_START_URL }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
          onShouldStartLoadWithRequest={(request) => {
            const decision = decideHelpDocsNavigation(request.url)
            if (decision === 'allow') return true
            if (decision === 'block') return false
            void Linking.openURL(decision.openExternalUrl)
            return false
          }}
          onLoadEnd={(event) => {
            const url = event.nativeEvent.url
            if (url && !isHelpDocsSuccessfulDocumentUrl(url) && url !== 'about:blank') {
              setFailed(true)
            }
          }}
          onError={() => setFailed(true)}
          onHttpError={(event) => {
            if (event.nativeEvent.statusCode >= 400) setFailed(true)
          }}
        />
      )}
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }
})
