/* eslint-disable @typescript-eslint/explicit-function-return-type -- Expo config plugin（CommonJS） */
const { withGradleProperties } = require('@expo/config-plugins')

/** 默认模板仅 2G 堆，D8 合并 dex 需 3G 堆；配合 G1GC 避免堆膨胀引发系统内存溢出 */
const RELEASE_JVM_ARGS = '-Xmx3072m -XX:MaxMetaspaceSize=768m -XX:+UseG1GC'
/** 限制 KotlinCompileDaemon 的堆内存，避免 Kotlin 守护进程与 Gradle 竞争堆空间 */
const KOTLIN_JVM_ARGS = '-Xmx1536m -XX:MaxMetaspaceSize=384m'

function setProperty(props, key, value) {
  const idx = props.findIndex((item) => item.type === 'property' && item.key === key)
  const entry = { type: 'property', key, value }
  if (idx >= 0) {
    props[idx] = entry
  } else {
    props.push(entry)
  }
}

/**
 * Release（BAISHOU_RELEASE_BUILD=1）合理配置 Gradle 与 Kotlin 守护进程堆内存，兼顾 D8 合并与系统内存安全。
 * @param {import('@expo/config-plugins').ExpoConfig} config
 * @returns {import('@expo/config-plugins').ExpoConfig}
 */
function withAndroidReleaseJvmArgs(config) {
  if (process.env.BAISHOU_RELEASE_BUILD !== '1') {
    return config
  }

  return withGradleProperties(config, (config) => {
    const props = config.modResults
    setProperty(props, 'org.gradle.jvmargs', RELEASE_JVM_ARGS)
    setProperty(props, 'kotlin.daemon.jvm.options', KOTLIN_JVM_ARGS)
    return config
  })
}

module.exports = withAndroidReleaseJvmArgs
