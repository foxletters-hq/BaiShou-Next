import { Redirect, useLocalSearchParams } from 'expo-router'
import { AIProviderDetailScreen } from '@/src/screens/SettingsScreen/AIProviderDetailScreen'

export default function AIProviderDetailRoute() {
  const { id: idParam } = useLocalSearchParams<{ id: string | string[] }>()
  const id = Array.isArray(idParam) ? idParam[0] : idParam

  if (!id) {
    return <Redirect href="/settings/ai-services" />
  }

  return <AIProviderDetailScreen providerId={decodeURIComponent(id)} />
}
