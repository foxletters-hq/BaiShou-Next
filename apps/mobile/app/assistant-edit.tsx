import { Redirect, useLocalSearchParams } from 'expo-router'

export default function AssistantEditRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const href = id
    ? { pathname: '/settings/assistant-edit' as const, params: { id } }
    : '/settings/assistants'
  return <Redirect href={href} />
}
