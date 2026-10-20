import { describe, expect, it, vi } from 'vitest'
import {
  MAX_SKILL_INSTRUCTION_DELTAS,
  loadAndUpdateSkillsInstruction,
  resolveSkillsInstructionSection,
  serializeInstructionState
} from '../instruction-state.util'

describe('instruction-state.util', () => {
  it('renders the full catalog and seeds the baseline on first use', () => {
    const section = resolveSkillsInstructionSection(
      [
        { name: 'beta', description: '第二个' },
        { name: 'alpha', description: '第一个' }
      ],
      null
    )

    expect(section.catalog[0]).toContain('Available skills')
    expect(section.catalog.slice(1)).toEqual(['- alpha: 第一个', '- beta: 第二个'])
    expect(section.deltas).toEqual([])
    expect(section.nextState?.skills?.entries.map((entry) => entry.name)).toEqual(['alpha', 'beta'])
  })

  it('keeps the frozen baseline byte-identical when the catalog is unchanged', () => {
    const stored = serializeInstructionState({
      version: 1,
      skills: { entries: [{ name: 'alpha', description: '旧描述' }] }
    })
    const section = resolveSkillsInstructionSection(
      [{ name: 'alpha', description: '旧描述' }],
      stored
    )
    expect(section.catalog).toEqual([
      'Available skills (name + description only). Call skill_read with the skill name to load the full body when you decide to use one. The user may also attach a skill with /name.',
      '- alpha: 旧描述'
    ])
    expect(section.deltas).toEqual([])
    expect(section.nextState).toBeNull()
  })

  it('appends deltas without touching the baseline when skills change', () => {
    const stored = serializeInstructionState({
      version: 1,
      skills: { entries: [{ name: 'alpha', description: '旧描述' }] }
    })
    const section = resolveSkillsInstructionSection(
      [
        { name: 'alpha', description: '新描述' },
        { name: 'beta', description: '新增' }
      ],
      stored
    )

    expect(section.catalog).toContain('- alpha: 旧描述')
    expect(section.deltas.join('\n')).toContain('- beta: 新增')
    expect(section.deltas.join('\n')).toContain('- alpha: 新描述')
    expect(section.nextState?.skills?.entries).toEqual([{ name: 'alpha', description: '旧描述' }])
  })

  it('reports removed skills in the delta', () => {
    const stored = serializeInstructionState({
      version: 1,
      skills: { entries: [{ name: 'alpha' }, { name: 'gone' }] }
    })
    const section = resolveSkillsInstructionSection([{ name: 'alpha' }], stored)
    expect(section.deltas.join('\n')).toContain('no longer available')
    expect(section.deltas.join('\n')).toContain('gone')
  })

  it('rebuilds the baseline once too many deltas accumulate', () => {
    const entries = [{ name: 'alpha' }]
    const deltas = Array.from(
      { length: MAX_SKILL_INSTRUCTION_DELTAS },
      (_, index) => `delta-${index}`
    )
    const stored = serializeInstructionState({ version: 1, skills: { entries, deltas } })
    const section = resolveSkillsInstructionSection([{ name: 'alpha' }, { name: 'beta' }], stored)
    expect(section.deltas).toEqual([])
    expect(section.catalog).toContain('- beta: No description')
  })

  it('persists the next state through the session repository', async () => {
    const updateSessionInstructionState = vi.fn().mockResolvedValue(undefined)
    const getSessionInstructionState = vi.fn().mockResolvedValue(null)
    const result = await loadAndUpdateSkillsInstruction({
      sessionRepo: { getSessionInstructionState, updateSessionInstructionState },
      sessionId: 's1',
      skillsCatalog: [{ name: 'alpha', description: 'A' }]
    })

    expect(result.catalog).toContain('- alpha: A')
    expect(updateSessionInstructionState).toHaveBeenCalledWith('s1', expect.any(String))
  })

  it('does not persist when the catalog is unavailable', async () => {
    const updateSessionInstructionState = vi.fn()
    const result = await loadAndUpdateSkillsInstruction({
      sessionRepo: {
        getSessionInstructionState: vi.fn().mockResolvedValue(null),
        updateSessionInstructionState
      },
      sessionId: 's1',
      skillsCatalog: undefined
    })
    expect(result).toEqual({ catalog: [], deltas: [] })
    expect(updateSessionInstructionState).not.toHaveBeenCalled()
  })
})
