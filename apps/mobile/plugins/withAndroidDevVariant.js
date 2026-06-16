/* eslint-disable @typescript-eslint/explicit-function-return-type -- Expo config plugin（CommonJS） */
const { withAppBuildGradle } = require('@expo/config-plugins')
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode')

const DEV_VARIANT = `            applicationIdSuffix ".dev"
            versionNameSuffix "-dev"
            resValue "string", "app_name", "白守 Dev"`

const RELEASE_WHEN_KEYSTORE =
  'signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug'

/**
 * debug 构建使用 com.baishou.baishou.dev，与正式包并存。
 * 有 key.properties 时 debug 也用正式签名，以便读取正式包/旧 Flutter 沙盒内的日记并镜像到外部存储。
 * @param {import('@expo/config-plugins').ExpoConfig} config
 * @returns {import('@expo/config-plugins').ExpoConfig}
 */
function withAndroidDevVariant(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents

    if (!contents.includes('applicationIdSuffix ".dev"')) {
      contents = mergeContents({
        tag: 'baishou-dev-variant',
        src: contents,
        newSrc: DEV_VARIANT,
        anchor: /^\s*debug\s*\{/,
        offset: 1,
        comment: '//'
      }).contents
    }

    const lines = contents.split('\n')
    let inBuildTypes = false
    let inDebug = false
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*buildTypes\s*\{/.test(line)) {
        inBuildTypes = true
        continue
      }
      if (!inBuildTypes) continue
      if (/^\s*debug\s*\{/.test(line)) {
        inDebug = true
        continue
      }
      if (inDebug && /^\s*signingConfig signingConfigs\.debug\s*$/.test(line)) {
        lines[i] = line.replace('signingConfig signingConfigs.debug', RELEASE_WHEN_KEYSTORE)
      }
      if (inDebug && /^\s*\}\s*$/.test(line)) break
    }
    contents = lines.join('\n')

    config.modResults.contents = contents
    return config
  })
}

module.exports = withAndroidDevVariant
