import { Redirect } from 'expo-router'
import { KnowledgeNotebookGraphNodeScreen } from '@/src/screens/KnowledgeScreen/KnowledgeNotebookGraphNodeScreen'

const KNOWLEDGE_ENTRY_ENABLED = false

export default function KnowledgeNotebookGraphNodeRoute() {
  if (!KNOWLEDGE_ENTRY_ENABLED) return <Redirect href="/(tabs)" />
  return <KnowledgeNotebookGraphNodeScreen />
}
