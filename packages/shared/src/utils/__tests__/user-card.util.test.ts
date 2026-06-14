import { describe, expect, it } from 'vitest'
import { formatUserCardFromProfile } from '../user-card.util'
import type { UserProfile } from '../../types/user-profile.types'

describe('formatUserCardFromProfile', () => {
  it('returns undefined when profile is empty', () => {
    expect(formatUserCardFromProfile(undefined)).toBeUndefined()
    expect(formatUserCardFromProfile(null)).toBeUndefined()
  })

  it('formats non-empty facts for active persona', () => {
    const profile: UserProfile = {
      nickname: 'Alice',
      avatarPath: null,
      activePersonaId: '工作',
      personas: {
        工作: {
          id: '工作',
          facts: { 职业: '工程师', 爱好: '  ' }
        }
      }
    }

    expect(formatUserCardFromProfile(profile)).toBe(
      '[User Identity Card / Persona: 工作]\n- 职业: 工程师'
    )
  })
})
