/* eslint-disable @typescript-eslint/explicit-function-return-type -- Expo config plugin（CommonJS） */
const { withGradleProperties } = require('@expo/config-plugins')

/** 正式包只打真机 ABI；x86/x86_64 仅模拟器需要，会显著放大 CI 磁盘与 APK */
const RELEASE_ARCHITECTURES = 'arm64-v8a'

/**
 * Release（BAISHOU_RELEASE_BUILD=1）将 reactNativeArchitectures 收窄为 arm64-v8a。
 * 日常 prebuild / 模拟器开发仍保留模板默认的四 ABI。
 * @param {import('@expo/config-plugins').ExpoConfig} config
 * @returns {import('@expo/config-plugins').ExpoConfig}
 */
function withAndroidReleaseArchitectures(config) {
  if (process.env.BAISHOU_RELEASE_BUILD !== '1') {
    return config
  }

  return withGradleProperties(config, (config) => {
    const props = config.modResults
    const idx = props.findIndex(
      (item) => item.type === 'property' && item.key === 'reactNativeArchitectures'
    )
    const entry = {
      type: 'property',
      key: 'reactNativeArchitectures',
      value: RELEASE_ARCHITECTURES
    }
    if (idx >= 0) {
      props[idx] = entry
    } else {
      props.push(entry)
    }
    return config
  })
}

module.exports = withAndroidReleaseArchitectures
