import { describe, expect, it } from 'vitest'
import type { AgentSkill } from '@baishou/shared'
import {
  mergeSkillsByName,
  omitBundledTemplateSkills,
  toCatalogEntries
} from '../agent-skills-merge.util'

function skill(
  name: string,
  description = name,
  source: AgentSkill['source'] = 'user'
): AgentSkill {
  return { name, description, content: '', location: `/tmp/${name}`, source }
}

describe('agent-skills-merge.util', () => {
  it('should let overlay replace the same name and sort by name', () => {
    const merged = mergeSkillsByName(
      [skill('beta', 'old'), skill('alpha', 'a')],
      [skill('beta', 'new')]
    )
    expect(merged.map((item) => item.name)).toEqual(['alpha', 'beta'])
    expect(merged[1]?.description).toBe('new')
  })

  it('should map skills to catalog entries', () => {
    expect(toCatalogEntries([skill('demo', 'desc')])).toEqual([
      { name: 'demo', description: 'desc' }
    ])
  })

  it('should keep user skills when omitting hidden bundled templates', () => {
    const kept = omitBundledTemplateSkills([skill('custom', 'c', 'user')])
    expect(kept).toHaveLength(1)
    expect(kept[0]?.name).toBe('custom')
  })
})
