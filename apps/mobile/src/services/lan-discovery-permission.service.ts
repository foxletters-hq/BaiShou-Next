import { Platform, PermissionsAndroid } from 'react-native'

export async function ensureLanDiscoveryPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true

  const permissions: string[] =
    Platform.Version >= 33
      ? [PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]

  const results = await PermissionsAndroid.requestMultiple(permissions)
  return permissions.every((permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED)
}
