import { describe, expect, it } from 'vitest'
import { DEFAULT_USER_PROFILE } from '../../constants/user-profile.constants'
import {
  applyGraphAwakenToProfile,
  isGraphAwakenProfileComplete,
  isValidUserBirthday,
  isValidUserGender,
  normalizeGraphAwakenNickname,
  validateGraphAwakenForm
} from '../graph-awaken.util'

describe('graph-awaken.util', () => {
  it('validates birthday and gender', () => {
    expect(isValidUserBirthday('1990-01-15')).toBe(true)
    expect(isValidUserBirthday('1990-13-01')).toBe(false)
    expect(isValidUserBirthday('')).toBe(false)
    expect(isValidUserGender('female')).toBe(true)
    expect(isValidUserGender('nope')).toBe(false)
  })

  it('requires nickname birthday gender for complete awaken', () => {
    expect(
      isGraphAwakenProfileComplete(true, {
        nickname: 'Alice',
        birthday: '1990-01-15',
        gender: 'female'
      })
    ).toBe(true)
    expect(
      isGraphAwakenProfileComplete(true, {
        nickname: 'Alice',
        birthday: null,
        gender: 'female'
      })
    ).toBe(false)
    expect(
      isGraphAwakenProfileComplete(false, {
        nickname: 'Alice',
        birthday: '1990-01-15',
        gender: 'female'
      })
    ).toBe(false)
  })

  it('validates form and applies to profile', () => {
    expect(normalizeGraphAwakenNickname(DEFAULT_USER_PROFILE.nickname)).toBe(null)
    expect(normalizeGraphAwakenNickname('  小明  ')).toBe('小明')
    expect(
      validateGraphAwakenForm({ nickname: '', birthday: '', gender: '' })
    ).toEqual({ nickname: 'nickname', birthday: 'birthday', gender: 'gender' })
    const next = applyGraphAwakenToProfile(DEFAULT_USER_PROFILE, {
      nickname: '小明',
      birthday: '2000-05-01',
      gender: 'male'
    })
    expect(next.nickname).toBe('小明')
    expect(next.birthday).toBe('2000-05-01')
    expect(next.gender).toBe('male')
  })
})
