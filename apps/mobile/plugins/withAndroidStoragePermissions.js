/* eslint-disable @typescript-eslint/explicit-function-return-type -- Expo config plugin（CommonJS） */
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins')
const {
  ensureToolsAvailable,
  getMainApplicationOrThrow
} = require('@expo/config-plugins/build/android/Manifest')

const STORAGE_PERMISSIONS = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.MANAGE_EXTERNAL_STORAGE'
]

const STORAGE_SETTINGS_QUERIES = [
  'android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION',
  'android.settings.MANAGE_ALL_FILES_ACCESS_PERMISSION',
  'android.settings.APPLICATION_DETAILS_SETTINGS'
]

/**
 * 强制注入外部存储权限与 legacy 标记。
 * app.json 的 permissions 在已有 android/ 目录时不会自动回写；realme 上若 Manifest
 * 缺少 MANAGE_EXTERNAL_STORAGE，系统「所有文件访问」开关会呈灰色不可点。
 * @param {import('@expo/config-plugins').ExpoConfig} config
 * @returns {import('@expo/config-plugins').ExpoConfig}
 */
function withAndroidStoragePermissions(config) {
  return withAndroidManifest(config, (config) => {
    let manifest = ensureToolsAvailable(config.modResults)
    AndroidConfig.Permissions.ensurePermissions(manifest, STORAGE_PERMISSIONS)

    const usesPermissions = manifest.manifest['uses-permission']
    if (!Array.isArray(usesPermissions)) {
      manifest.manifest['uses-permission'] = usesPermissions ? [usesPermissions] : []
    }

    const manageEntry = manifest.manifest['uses-permission'].find(
      (entry) => entry.$?.['android:name'] === 'android.permission.MANAGE_EXTERNAL_STORAGE'
    )
    if (manageEntry) {
      manageEntry.$['tools:ignore'] = 'ScopedStorage'
    }

    const application = getMainApplicationOrThrow(manifest)
    application.$['android:requestLegacyExternalStorage'] = 'true'

    const queries = manifest.manifest.queries
    const queryList = Array.isArray(queries) ? queries : queries ? [queries] : []
    for (const action of STORAGE_SETTINGS_QUERIES) {
      const exists = queryList.some((q) =>
        (Array.isArray(q.intent) ? q.intent : q.intent ? [q.intent] : []).some(
          (intent) => intent.action?.some?.((a) => a.$?.['android:name'] === action)
        )
      )
      if (!exists) {
        queryList.push({
          intent: [{ action: [{ $: { 'android:name': action } }] }]
        })
      }
    }
    manifest.manifest.queries = queryList

    config.modResults = manifest
    return config
  })
}

module.exports = withAndroidStoragePermissions
