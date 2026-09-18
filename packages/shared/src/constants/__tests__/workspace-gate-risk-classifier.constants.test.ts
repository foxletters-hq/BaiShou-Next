import { describe, expect, it } from 'vitest'
import { WORKSPACE_GATE_RISK_CLASSIFIER_INSTRUCTIONS } from '../workspace-gate-risk-classifier.constants'

describe('workspace-gate-risk-classifier.constants', () => {
  it('asks the model for a one-line allow/ask JSON verdict', () => {
    expect(WORKSPACE_GATE_RISK_CLASSIFIER_INSTRUCTIONS).toContain('"verdict"')
    expect(WORKSPACE_GATE_RISK_CLASSIFIER_INSTRUCTIONS).toContain('allow')
    expect(WORKSPACE_GATE_RISK_CLASSIFIER_INSTRUCTIONS).toContain('ask')
  })
})
