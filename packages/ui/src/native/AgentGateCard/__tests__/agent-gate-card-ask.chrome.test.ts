import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const askFieldsSource = readFileSync(join(here, '..', 'CompanionAskFields.tsx'), 'utf8')
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

  it('should page with chevrons so the primary action is the only 下一题', () => {
    expect(askFieldsSource).toContain('<ChevronLeft')
    expect(askFieldsSource).toContain('<ChevronRight')
    expect(askFieldsSource).toContain("accessibilityLabel={t('agent_gate.queue_next'")
    expect(askFieldsSource).not.toMatch(/<Button[\s\S]*?\{t\('agent_gate.queue_next'/)
    expect(askFieldsSource).toContain("t('agent_gate.ask_next', '下一题')")
  })

  it('should disable confirm until the current question is answered and keep skip enabled', () => {
    expect(askFieldsSource).toContain('companionAskQuestionAnswered')
    expect(askFieldsSource).toContain('disabled={isReplying || !canAdvance}')
    expect(askFieldsSource).toMatch(/disabled=\{isReplying\}\s+onPress=\{onSkip\}/)
  })

  it('should lift the card above the bottom edge with theme spacing', () => {
    expect(cardSource).toContain('tokens.spacing.xl')
    expect(cardSource).toContain('tokens.spacing.md + insets.bottom')
  })
})
