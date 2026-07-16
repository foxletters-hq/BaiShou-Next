/* eslint-disable @typescript-eslint/explicit-function-return-type -- Expo config plugin（CommonJS） */
const fs = require('fs')
const path = require('path')
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('@expo/config-plugins')
const {
  ensureToolsAvailable,
  getMainApplicationOrThrow
} = require('@expo/config-plugins/build/android/Manifest')

const LAN_PERMISSIONS = [
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.ACCESS_WIFI_STATE',
  'android.permission.CHANGE_WIFI_MULTICAST_STATE',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.NEARBY_WIFI_DEVICES'
]

const NETWORK_SECURITY_CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<!-- 信任系统与用户安装的 CA，并允许明文 HTTP（群晖 WebDAV 5005 / 局域网 NAS） -->
<network-security-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
      <certificates src="user" />
    </trust-anchors>
  </base-config>
</network-security-config>
`

/**
 * 局域网权限 + 明文 HTTP + 信任用户 CA（群晖自签证书安装到系统后可用）。
 * @param {import('@expo/config-plugins').ExpoConfig} config
 * @returns {import('@expo/config-plugins').ExpoConfig}
 */
function withAndroidLanPermissions(config) {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const xmlDir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/xml')
      fs.mkdirSync(xmlDir, { recursive: true })
      fs.writeFileSync(
        path.join(xmlDir, 'network_security_config.xml'),
        NETWORK_SECURITY_CONFIG_XML
      )
      return config
    }
  ])

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
    application.$['android:networkSecurityConfig'] = '@xml/network_security_config'

    config.modResults = manifest
    return config
  })
}

module.exports = withAndroidLanPermissions
