/* eslint-disable @typescript-eslint/explicit-function-return-type -- Expo config plugin（CommonJS） */
const { withAppBuildGradle } = require('@expo/config-plugins')
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode')

const KEYSTORE_LOADER = `    def keystorePropertiesFile = rootProject.file("key.properties")
    def keystoreProperties = new Properties()
    if (keystorePropertiesFile.exists()) {
        keystoreProperties.load(keystorePropertiesFile.newInputStream())
    }`

const RELEASE_SIGNING_CONFIG = `        release {
            if (keystorePropertiesFile.exists()) {
                keyAlias keystoreProperties.getProperty("keyAlias")
                keyPassword keystoreProperties.getProperty("keyPassword")
                storePassword keystoreProperties.getProperty("storePassword")

                def storeBase64 = keystoreProperties.getProperty("storeBase64")
                def storeFilePath = keystoreProperties.getProperty("storeFile")

                if (storeBase64 != null && !storeBase64.isEmpty()) {
                    def tmpKeystore = file("\${layout.buildDirectory.get()}/tmp_keystore/upload.jks")
                    tmpKeystore.parentFile.mkdirs()
                    tmpKeystore.bytes = Base64.decoder.decode(storeBase64)
                    storeFile tmpKeystore
                } else if (storeFilePath != null) {
                    storeFile file(storeFilePath)
                }
            }
        }`

const RELEASE_WHEN_KEYSTORE =
  'signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug'

/** 仅 release 使用正式签名 */
function patchReleaseBuildTypeSigning(contents) {
  const lines = contents.split('\n')
  let inBuildTypes = false
  let inRelease = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*buildTypes\s*\{/.test(line)) {
      inBuildTypes = true
      continue
    }
    if (!inBuildTypes) continue
    if (/^\s*release\s*\{/.test(line)) {
      inRelease = true
      continue
    }
    if (inRelease && /^\s*signingConfig signingConfigs\.debug\s*$/.test(line)) {
      if (!line.includes('keystorePropertiesFile.exists()')) {
        lines[i] = line.replace('signingConfig signingConfigs.debug', RELEASE_WHEN_KEYSTORE)
      }
      return lines.join('\n')
    }
    if (inRelease && /^\s*\}\s*$/.test(line)) {
      return lines.join('\n')
    }
  }

  return contents
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

    if (!contents.includes('signingConfigs.release')) {
      contents = mergeContents({
        tag: 'baishou-release-signing-config',
        src: contents,
        newSrc: RELEASE_SIGNING_CONFIG,
        anchor: /keyPassword 'android'/,
        offset: 1,
        comment: '//'
      }).contents
    }

    contents = patchReleaseBuildTypeSigning(contents)

    config.modResults.contents = contents
    return config
  })
}

module.exports = withAndroidReleaseSigning
