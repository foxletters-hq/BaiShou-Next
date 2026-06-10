import { Redirect } from 'expo-router'

/** 存储管理已内联在设置页，旧路由重定向 */
export default function StorageRoute() {
  return <Redirect href="/(tabs)/settings" />
}
