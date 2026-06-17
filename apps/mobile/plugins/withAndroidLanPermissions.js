/* eslint-disable @typescript-eslint/explicit-function-return-type -- Expo config plugin（CommonJS） */
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins')
const { ensureToolsAvailable, getMainApplicationOrThrow } = require('@expo/config-plugins/build/android/Manifest')

const LAN_PERMISSIONS = [
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.ACCESS_WIFI_STATE',
  'android.permission.CHANGE_WIFI_MULTICAST_STATE',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.NEARBY_WIFI_DEVICES'
]

/**
 * 局域网 mDNS 发现依赖组播锁，必须在 AndroidManifest 中声明 CHANGE_WIFI_MULTICAST_STATE。
 * app.json 的 permissions 在已有 android/ 目录时不会自动回写，故用插件强制注入。
 * @param {import('@expo/config-plugins').ExpoConfig} config
 * @returns {import('@expo/config-plugins').ExpoConfig}
 */
function withAndroidLanPermissions(config) {
  return withAndroidManifest(config, (config) => {
    let manifest = ensureToolsAvailable(config.modResults)
    AndroidConfig.Permissions.ensurePermissions(manifest, LAN_PERMISSIONS)

    const usesPermissions = manifest.manifest['uses-permission']
    if (!Array.isArray(usesPermissions)) {
      manifest.manifest['uses-permission'] = usesPermissions ? [usesPermissions] : []
    }

    const nearby = 'android.permission.NEARBY_WIFI_DEVICES'
    const list = manifest.manifest['uses-permission']
    const nearbyEntry = list.find((entry) => entry.$?.['android:name'] === nearby)
    if (nearbyEntry) {
      nearbyEntry.$['android:usesPermissionFlags'] = 'neverForLocation'
      nearbyEntry.$['tools:targetApi'] = '33'
    }

    const application = getMainApplicationOrThrow(manifest)
    application.$['android:usesCleartextTraffic'] = 'true'

    config.modResults = manifest
    return config
  })
}

module.exports = withAndroidLanPermissions
