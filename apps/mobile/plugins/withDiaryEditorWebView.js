/* eslint-disable @typescript-eslint/explicit-function-return-type -- Expo config plugin（CommonJS） */
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins')

/**
 * 日记 CodeMirror WebView 宿主的原生侧配置（阶段二 W-2 / W-3）。
 *
 * WebView 组件侧（NativeDiaryCodeMirrorEditor，阶段 W-10）还需设置：
 * - allowFileAccess / allowFileAccessFromFileURLs（加载 bundle 内 index.html）
 * - originWhitelist={['*']} 或 file://
 * - mixedContentMode="always"（Android：本地 HTML 内嵌 http 资源时）
 * - javaScriptEnabled={true}
 *
 * iOS WKWebView 加载 Metro/asset 打包的本地 HTML 通常无需额外 Info.plist；
 * 若改用 file:// 直读外部目录，需在宿主组件设置 allowingReadAccessToURL。
 *
 * @param {import('@expo/config-plugins').ExpoConfig} config
 * @returns {import('@expo/config-plugins').ExpoConfig}
 */
function withDiaryEditorWebView(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults)
    const activities = mainApplication.activity ?? []

    for (const activity of activities) {
      const name = activity.$?.['android:name'] ?? ''
      if (name === '.MainActivity' || name.endsWith('.MainActivity')) {
        // hardwareAccelerated：WebView 合成与滚动性能；默认 true，此处显式声明
        activity.$['android:hardwareAccelerated'] = 'true'
      }
    }

    // usesCleartextTraffic：开发期 W-9 localhost 热更新时可按需开启；正式 bundle 走 asset 无需
    if (process.env.DIARY_CM_WEBVIEW_CLEARTEXT === '1') {
      mainApplication.$['android:usesCleartextTraffic'] = 'true'
    }

    return config
  })
}

module.exports = withDiaryEditorWebView
