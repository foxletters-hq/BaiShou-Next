/* eslint-disable @typescript-eslint/explicit-function-return-type -- Expo config plugin（CommonJS） */
const { withGradleProperties } = require('@expo/config-plugins')

/** 默认模板仅 2G 堆，依赖规模大时 :app:mergeDexRelease 的 D8 会 OOM */
const RELEASE_JVM_ARGS = '-Xmx4096m -XX:MaxMetaspaceSize=1024m'

/**
 * Release（BAISHOU_RELEASE_BUILD=1）提高 Gradle 守护进程堆内存，避免 D8 合并 dex 时 OOM。
 * @param {import('@expo/config-plugins').ExpoConfig} config
 * @returns {import('@expo/config-plugins').ExpoConfig}
 */
function withAndroidReleaseJvmArgs(config) {
  if (process.env.BAISHOU_RELEASE_BUILD !== '1') {
    return config
  }

  return withGradleProperties(config, (config) => {
    const props = config.modResults
    const idx = props.findIndex(
      (item) => item.type === 'property' && item.key === 'org.gradle.jvmargs'
    )
    const entry = {
      type: 'property',
      key: 'org.gradle.jvmargs',
      value: RELEASE_JVM_ARGS
    }
    if (idx >= 0) {
      props[idx] = entry
    } else {
      props.push(entry)
    }
    return config
  })
}

module.exports = withAndroidReleaseJvmArgs
