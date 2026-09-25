import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const cardSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AgentGateCard.tsx'),
  'utf8'
)

describe('AgentGateCard companion ask', () => {
  it('should collect questionAnswers on one card', () => {
    expect(cardSource).toContain('CompanionAskFields')
    expect(cardSource).toContain('listAgentGateFileChangePreviews')
    expect(cardSource).toContain('questionAnswers')
    expect(cardSource).toContain('buildCompanionAskQuestionAnswers')
  })
})
