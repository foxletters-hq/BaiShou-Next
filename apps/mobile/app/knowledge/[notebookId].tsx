import { Redirect } from 'expo-router'
import { KnowledgeDetailScreen } from '@/src/screens/KnowledgeScreen/KnowledgeDetailScreen'

const KNOWLEDGE_ENTRY_ENABLED = false

export default function KnowledgeDetailRoute() {
  if (!KNOWLEDGE_ENTRY_ENABLED) return <Redirect href="/(tabs)" />
  return <KnowledgeDetailScreen />
}
