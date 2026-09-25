import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function readKnowledge(fileName: string): string {
  return readFileSync(join(here, '..', fileName), 'utf8')
}

describe('knowledge list chrome', () => {
  it('should delete a notebook from the card menu after a three-second dialog', () => {
    const list = readKnowledge('KnowledgeListPage.tsx')
    const card = readKnowledge('SortableNotebookCard.tsx')
    const dialog = readKnowledge('KnowledgeDeleteNotebookDialog.tsx')

    expect(list).toContain('KnowledgeDeleteNotebookDialog')
    expect(list).toContain('window.api.knowledge.deleteNotebook')
    expect(card).toContain('labels.deleteNotebook')
    expect(card).toContain('onDelete')
    expect(card).toContain("from '@baishou/ui'")
    expect(dialog).toContain('isNotebookHeavyConfirmReady')
    expect(dialog).toContain('notebookHeavyConfirmSecondsLeft')
    expect(dialog).toContain("from '@baishou/ui'")
    expect(dialog).toContain('KnowledgeDialog')
  })
})
