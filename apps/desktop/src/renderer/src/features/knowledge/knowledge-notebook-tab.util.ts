export const KNOWLEDGE_NOTEBOOK_TABS = ['sources', 'graph', 'vectors'] as const

export type KnowledgeNotebookTab = (typeof KNOWLEDGE_NOTEBOOK_TABS)[number]

export function isKnowledgeNotebookTab(value: string): value is KnowledgeNotebookTab {
  return (KNOWLEDGE_NOTEBOOK_TABS as readonly string[]).includes(value)
}
