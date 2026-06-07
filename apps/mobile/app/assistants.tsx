import { Redirect } from 'expo-router'

/** 兼容旧深链，统一走 settings 栈转场 */
export default function AssistantsRedirect() {
  return <Redirect href="/settings/assistants" />
}
