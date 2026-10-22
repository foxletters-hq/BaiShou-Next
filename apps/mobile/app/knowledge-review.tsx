import { Redirect } from 'expo-router'
import { KnowledgeNotebookGraphReviewScreen } from '@/src/screens/KnowledgeScreen/KnowledgeNotebookGraphReviewScreen'

const KNOWLEDGE_ENTRY_ENABLED = false

export default function KnowledgeNotebookGraphReviewRoute() {
  if (!KNOWLEDGE_ENTRY_ENABLED) return <Redirect href="/(tabs)" />
  return <KnowledgeNotebookGraphReviewScreen />
}
