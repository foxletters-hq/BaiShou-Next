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

  it('includes birthday and gender when shareIdentityWithCompanion is true or default', () => {
    const profile: UserProfile = {
      nickname: 'Bob',
      birthday: '1996-08-20',
      gender: 'male',
      avatarPath: null,
      activePersonaId: '默认身份卡',
      personas: {
        默认身份卡: {
          id: '默认身份卡',
          facts: { 爱好: '打羽毛球' }
        }
      }
    }

    expect(formatUserCardFromProfile(profile)).toBe(
      '[User Identity Card / Persona: 默认身份卡]\n- 生日: 1996-08-20\n- 性别: 男\n- 爱好: 打羽毛球'
    )
  })

  it('omits birthday and gender when shareIdentityWithCompanion is false', () => {
    const profile: UserProfile = {
      nickname: 'Bob',
      birthday: '1996-08-20',
      gender: 'male',
      shareIdentityWithCompanion: false,
      avatarPath: null,
      activePersonaId: '默认身份卡',
      personas: {
        默认身份卡: {
          id: '默认身份卡',
          facts: { 爱好: '打羽毛球', 生日: '1996-08-20', 性别: '男' }
        }
      }
    }

    expect(formatUserCardFromProfile(profile)).toBe(
      '[User Identity Card / Persona: 默认身份卡]\n- 爱好: 打羽毛球'
    )
  })

  it('returns undefined if facts are empty and shareIdentityWithCompanion is false', () => {
    const profile: UserProfile = {
      nickname: 'Bob',
      birthday: '1996-08-20',
      gender: 'male',
      shareIdentityWithCompanion: false,
      avatarPath: null,
      activePersonaId: '默认身份卡',
      personas: {
        默认身份卡: {
          id: '默认身份卡',
          facts: {}
        }
      }
    }

    expect(formatUserCardFromProfile(profile)).toBeUndefined()
  })

  it('formats correctly when only birthday/gender exist without custom facts', () => {
    const profile: UserProfile = {
      nickname: 'Carol',
      birthday: '2000-01-01',
      gender: 'female',
      avatarPath: null,
      activePersonaId: '默认身份卡',
      personas: {
        默认身份卡: {
          id: '默认身份卡',
          facts: {}
        }
      }
    }

    expect(formatUserCardFromProfile(profile)).toBe(
      '[User Identity Card / Persona: 默认身份卡]\n- 生日: 2000-01-01\n- 性别: 女'
    )
  })

  it('uses customGender when gender is other and omits gender when unspecified', () => {
    const customProfile: UserProfile = {
      nickname: 'Dana',
      birthday: '2000-01-01',
      gender: 'other',
      customGender: '  沃尔玛购物袋  ',
      avatarPath: null,
      activePersonaId: '默认身份卡',
      personas: {
        默认身份卡: {
          id: '默认身份卡',
          facts: {}
        }
      }
    }

    expect(formatUserCardFromProfile(customProfile)).toBe(
      '[User Identity Card / Persona: 默认身份卡]\n- 生日: 2000-01-01\n- 性别: 沃尔玛购物袋'
    )

    const unspecifiedProfile: UserProfile = {
      ...customProfile,
      gender: 'unspecified',
      customGender: null
    }

    expect(formatUserCardFromProfile(unspecifiedProfile)).toBe(
      '[User Identity Card / Persona: 默认身份卡]\n- 生日: 2000-01-01'
    )
  })
})
