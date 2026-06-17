/* eslint-disable @typescript-eslint/explicit-function-return-type -- Expo config plugin（CommonJS） */
const { withAppBuildGradle } = require('@expo/config-plugins')
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode')

const KEYSTORE_LOADER = `    def keystorePropertiesFile = rootProject.file("key.properties")
    def keystoreProperties = new Properties()
    if (keystorePropertiesFile.exists()) {
        keystoreProperties.load(keystorePropertiesFile.newInputStream())
    }`

const RELEASE_WHEN_KEYSTORE =
  'signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug'

const RELEASE_SIGNING_LINES = [
  '        release {',
  '            if (keystorePropertiesFile.exists()) {',
  '                keyAlias keystoreProperties.getProperty("keyAlias")',
  '                keyPassword keystoreProperties.getProperty("keyPassword")',
  '                storePassword keystoreProperties.getProperty("storePassword")',
  '',
  '                def storeBase64 = keystoreProperties.getProperty("storeBase64")',
  '                def storeFilePath = keystoreProperties.getProperty("storeFile")',
  '',
  '                if (storeBase64 != null && !storeBase64.isEmpty()) {',
  '                    def tmpKeystore = file("${layout.buildDirectory.get()}/tmp_keystore/upload.jks")',
  '                    tmpKeystore.parentFile.mkdirs()',
  '                    tmpKeystore.bytes = Base64.decoder.decode(storeBase64)',
  '                    storeFile tmpKeystore',
  '                } else if (storeFilePath != null) {',
  '                    storeFile file(storeFilePath)',
  '                }',
  '            }',
  '        }'
]

/** 在 signingConfigs 闭合前注入 release 块（勿用 signingConfigs.release 字符串判断，dev 插件会先写入引用） */
function injectReleaseSigningConfig(contents) {
  if (contents.includes('baishou-release-signing-config')) {
    return contents
  }

  const lines = contents.split('\n')
  let inSigningConfigs = false
  let braceDepth = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*signingConfigs\s*\{/.test(line)) {
      inSigningConfigs = true
      braceDepth = 1
      continue
    }
    if (!inSigningConfigs) continue

    braceDepth += (line.match(/\{/g) || []).length
    braceDepth -= (line.match(/\}/g) || []).length

    if (braceDepth === 0) {
      lines.splice(i, 0, '        // @generated begin baishou-release-signing-config', ...RELEASE_SIGNING_LINES, '        // @generated end baishou-release-signing-config')
      return lines.join('\n')
    }
  }

  throw new Error('[withAndroidReleaseSigning] 未找到 signingConfigs 注入点')
}

/** release / debug buildType 在存在 key.properties 时使用正式签名 */
function patchBuildTypeSigning(contents) {
  const lines = contents.split('\n')
  let inBuildTypes = false
  let inTarget = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*buildTypes\s*\{/.test(line)) {
      inBuildTypes = true
      continue
    }
    if (!inBuildTypes) continue
    if (/^\s*(debug|release)\s*\{/.test(line)) {
      inTarget = true
      continue
    }
    if (inTarget && /^\s*signingConfig signingConfigs\.debug\s*$/.test(line)) {
      if (!line.includes('keystorePropertiesFile.exists()')) {
        lines[i] = line.replace('signingConfig signingConfigs.debug', RELEASE_WHEN_KEYSTORE)
      }
      inTarget = false
      continue
    }
    if (inTarget && /^\s*\}\s*$/.test(line)) {
      inTarget = false
    }
  }

  return lines.join('\n')
}

/**
 * 注入 Android release 签名（读取 android/key.properties，与旧版 Flutter 一致）。
 * @param {import('@expo/config-plugins').ExpoConfig} config
 * @returns {import('@expo/config-plugins').ExpoConfig}
 */
function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents

    if (!contents.includes('import java.util.Properties')) {
      contents = contents.replace(
        /(apply plugin:[^\n]+\n)+/,
        (match) => `${match}\nimport java.util.Properties\nimport java.util.Base64\n`
      )
    }

    if (
      !contents.includes('baishou-keystore-loader') &&
      !contents.includes('def keystorePropertiesFile = rootProject.file("key.properties")')
    ) {
      contents = mergeContents({
        tag: 'baishou-keystore-loader',
        src: contents,
        newSrc: KEYSTORE_LOADER,
        anchor: /signingConfigs\s*\{/,
        offset: 0,
        comment: '//'
      }).contents
    }

    contents = injectReleaseSigningConfig(contents)
    contents = patchBuildTypeSigning(contents)

    config.modResults.contents = contents
    return config
  })
}

module.exports = withAndroidReleaseSigning
