import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const cardSource = [
  'AgentGateCard.tsx',
  'AgentGateCardActions.tsx',
  'AgentGatePreviewBlocks.tsx',
  'CompanionAskFields.tsx'
]
  .map((name) => readFileSync(join(here, '..', name), 'utf8'))
  .join('\n')

describe('AgentGateCard companion ask', () => {
  it('should collect questionAnswers on one card', () => {
    expect(cardSource).toContain('CompanionAskFields')
    expect(cardSource).toContain('listAgentGateFileChangePreviews')
    expect(cardSource).toContain('questionAnswers')
    expect(cardSource).toContain('buildCompanionAskQuestionAnswers')
  })

  it('should keep question paging and custom answers above the keyboard', () => {
    expect(cardSource).toContain('part="footer"')
    expect(cardSource).toContain('onQueuePrev')
    expect(cardSource).toContain('onQueueNext')
    expect(cardSource).toContain('keyboardDidShow')
    expect(cardSource).toContain('onCustomFocus')
    expect(cardSource).toContain('scrollToEnd')
  })
})
