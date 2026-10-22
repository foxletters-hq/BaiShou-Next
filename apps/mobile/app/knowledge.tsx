import { Redirect } from 'expo-router'
import { KnowledgeScreen } from '@/src/screens/KnowledgeScreen/KnowledgeScreen'

const KNOWLEDGE_ENTRY_ENABLED = false

export default function KnowledgeRoute() {
  if (!KNOWLEDGE_ENTRY_ENABLED) return <Redirect href="/(tabs)" />
  return <KnowledgeScreen />
}
