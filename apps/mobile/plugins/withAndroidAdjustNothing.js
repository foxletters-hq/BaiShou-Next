/* eslint-disable @typescript-eslint/explicit-function-return-type -- Expo config plugin（CommonJS） */
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins')

/**
 * 禁用 Android 系统对键盘的全局平移/resize，改由各页面自行处理 inset。
 * 避免 Tab 页（如伙伴聊天）出现整页上移、顶栏被推出屏幕的问题。
 * @param {import('@expo/config-plugins').ExpoConfig} config
 * @returns {import('@expo/config-plugins').ExpoConfig}
 */
function withAndroidAdjustNothing(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults)
    const activities = mainApplication.activity ?? []

    for (const activity of activities) {
      const name = activity.$?.['android:name'] ?? ''
      if (name === '.MainActivity' || name.endsWith('.MainActivity')) {
        activity.$['android:windowSoftInputMode'] = 'adjustNothing'
      }
    }

    return config
  })
}

module.exports = withAndroidAdjustNothing
