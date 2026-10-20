import { describe, expect, it } from 'vitest'
import { AgentGateEffect } from '@baishou/shared'
import { filterSkillsCatalogByGate } from '../skill-catalog-filter.util'

describe('skill-catalog-filter.util', () => {
  it('drops skills denied by a skill_read resource rule', () => {
    const catalog = [
      { name: 'visible', description: 'A' },
      { name: 'blocked', description: 'B' }
    ]
    const filtered = filterSkillsCatalogByGate(catalog, {
      agentGate: {
        probeEffect: ({ resources }: { resources?: Array<{ value: string }> }) =>
          resources?.some((resource) => resource.value === 'blocked')
            ? AgentGateEffect.Deny
            : AgentGateEffect.Allow
      } as any
    })
    expect(filtered.map((entry) => entry.name)).toEqual(['visible'])
  })

  it('keeps the catalog when no gate is present or probe throws', () => {
    const catalog = [{ name: 'alpha' }]
    expect(filterSkillsCatalogByGate(catalog, {})).toEqual(catalog)
    expect(
      filterSkillsCatalogByGate(catalog, {
        agentGate: {
          probeEffect: () => {
            throw new Error('boom')
          }
        } as any
      })
    ).toEqual(catalog)
  })
})
