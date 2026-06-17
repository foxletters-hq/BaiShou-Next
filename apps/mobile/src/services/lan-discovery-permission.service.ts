import { Platform, PermissionsAndroid, type Permission } from 'react-native'

export async function ensureLanDiscoveryPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true

  const permissions: Permission[] =
    Platform.Version >= 33
      ? [PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]

  const results = await PermissionsAndroid.requestMultiple(permissions)
  return permissions.every(
    (permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED
  )
}
