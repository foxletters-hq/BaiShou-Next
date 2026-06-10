import { Redirect, useLocalSearchParams, type Href } from 'expo-router'

export default function AssistantEditRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const href = (
    id ? `/settings/assistant-edit?id=${encodeURIComponent(id)}` : '/settings/assistants'
  ) as Href
  return <Redirect href={href} />
}
