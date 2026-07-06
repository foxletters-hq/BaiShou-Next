import { SettingsDetailScreen } from '@/src/screens/SettingsScreen/SettingsDetailScreen'

/** 与伙伴管理等页一致：独立栈路由，避免 Android 上 [section] 动态路由转场异常 */
export default function AgentToolsSettingsRoute() {
  return <SettingsDetailScreen section="agent-tools" />
}
