/* eslint-disable @typescript-eslint/explicit-function-return-type -- Expo config plugin（CommonJS） */
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins')

/**
 * 冷启动时勿自动加载上次 bundle，避免 MainActivity.onCreate 与 DevLauncher loadApp 竞态崩溃：
 * App react context shouldn't be created before.
 */
function withAndroidDevLauncherLaunchMode(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults)
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      mainApplication,
      'DEV_CLIENT_TRY_TO_LAUNCH_LAST_BUNDLE',
      'false'
    )
    return config
  })
}

module.exports = withAndroidDevLauncherLaunchMode
