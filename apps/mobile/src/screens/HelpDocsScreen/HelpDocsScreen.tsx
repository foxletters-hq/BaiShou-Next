import React, { useRef, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { WebView } from 'react-native-webview'
import * as Linking from 'expo-linking'
import { ExternalLink } from 'lucide-react-native'
import {
  decideHelpDocsNavigation,
  HELP_DOCS_QUICK_START_URL,
  isHelpDocsSuccessfulDocumentUrl
} from '@baishou/shared'
import { Button, useNativeTheme } from '@baishou/ui/native'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { sharedTokens } from '@baishou/ui/theme/tokens'

const HIDE_DOCS_WEB_HEADER_JS = `
  (function() {
    var css = ''
      + ':root { --safe-top: 0px !important; --nav-height: 0px !important; --nav-bar-height: 0px !important; } '
      + '.site-header { display: none !important; } '
      + '.docs-shell { padding-top: 0 !important; } '
      + '.docs-sidebar { top: 0 !important; bottom: 0 !important; height: 100vh !important; height: 100dvh !important; max-height: 100vh !important; max-height: 100dvh !important; padding-top: 14px !important; overflow-y: auto !important; -webkit-overflow-scrolling: touch !important; overscroll-behavior-y: contain !important; touch-action: pan-y !important; } '
      + '.docs-main { padding-top: 12px !important; } '
      + 'html, body { padding-top: 0 !important; }';

    function injectStyle() {
      if (document.getElementById('baishou-hide-header-style')) {
        return;
      }
      var target = document.head || document.documentElement;
      if (!target) {
        return;
      }
      var style = document.createElement('style');
      style.id = 'baishou-hide-header-style';
      style.textContent = css;
      target.appendChild(style);
    }

    try {
      injectStyle();
    } catch (_) {}

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectStyle);
    }
    window.addEventListener('load', injectStyle);
    document.addEventListener('astro:page-load', injectStyle);
    document.addEventListener('astro:after-swap', injectStyle);

    try {
      var observer = new MutationObserver(function() {
        injectStyle();
      });
      var root = document.documentElement || document;
      if (root) {
        observer.observe(root, { childList: true, subtree: true });
      }
    } catch (_) {}
  })();
  true;
`

export function HelpDocsScreen() {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const router = useRouter()
  const chrome = getStackScreenChrome(colors)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const webViewRef = useRef<WebView>(null)

  return (
    <StackScreenLayout
      title={t('settings.help_docs', '帮助文档')}
      {...chrome}
      onBack={() => router.back()}
      headerRight={{
        icon: ExternalLink,
        accessibilityLabel: t('settings.help_docs_open_browser', '在浏览器中打开'),
        onPress: () => {
          void Linking.openURL(HELP_DOCS_QUICK_START_URL)
        }
      }}
      contentStyle={{ flex: 1 }}
    >
      {failed ? (
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary, marginBottom: sharedTokens.spacing.mdTight }}>
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
          ref={webViewRef}
          key={reloadKey}
          source={{ uri: HELP_DOCS_QUICK_START_URL }}
          startInLoadingState
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          injectedJavaScriptBeforeContentLoaded={HIDE_DOCS_WEB_HEADER_JS}
          injectedJavaScript={HIDE_DOCS_WEB_HEADER_JS}
          style={{ flex: 1, backgroundColor: colors.bgApp }}
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
            webViewRef.current?.injectJavaScript(HIDE_DOCS_WEB_HEADER_JS)
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: sharedTokens.spacing.lg
  }
})
