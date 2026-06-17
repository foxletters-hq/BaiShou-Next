/* eslint-disable @typescript-eslint/explicit-function-return-type -- Expo config plugin（CommonJS） */
const { withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

/**
 * prebuild 后 MainActivity 可能出现重复的 SplashScreenManager.registerOnActivity。
 * 保留 expo-splash-screen 生成块内的一处即可。
 */
function dedupeMainActivitySplashRegistration(contents) {
  return contents.replace(
    /SplashScreenManager\.registerOnActivity\(this\)\s*\n\s*\/\/ @generated begin expo-splashscreen/,
    '// @generated begin expo-splashscreen'
  )
}

function withAndroidMainActivitySplash(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const mainActivityPath = path.join(
        config.modRequest.projectRoot,
        'android/app/src/main/java/com/baishou/baishou/MainActivity.kt'
      )
      if (!fs.existsSync(mainActivityPath)) return config

      const original = fs.readFileSync(mainActivityPath, 'utf8')
      const next = dedupeMainActivitySplashRegistration(original)
      if (next !== original) {
        fs.writeFileSync(mainActivityPath, next, 'utf8')
      }
      return config
    }
  ])
}

module.exports = withAndroidMainActivitySplash
