import type { UserGender, UserProfile } from '../types/user-profile.types'
import { isDefaultGraphSelfName, isGraphSelfNameConfigured } from './diary-status-bar.util'

export const USER_GENDER_OPTIONS: readonly UserGender[] = [
  'male',
  'female',
  'other',
  'unspecified'
] as const

const BIRTHDAY_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidUserBirthday(value: string | null | undefined): boolean {
  const raw = value?.trim() ?? ''
  if (!BIRTHDAY_RE.test(raw)) return false
  const d = new Date(`${raw}T00:00:00`)
  if (Number.isNaN(d.getTime())) return false
  const [y, m, day] = raw.split('-').map(Number)
  return d.getFullYear() === y && d.getMonth() + 1 === m && d.getDate() === day
}

export function isValidUserGender(value: string | null | undefined): value is UserGender {
  return USER_GENDER_OPTIONS.includes(value as UserGender)
}

/** 图谱唤醒资料是否完整（昵称 + 生日 + 性别） */
export function isGraphAwakenProfileComplete(
  flag: boolean | null | undefined,
  profile: Pick<UserProfile, 'nickname' | 'birthday' | 'gender'> | null | undefined
): boolean {
  if (!isGraphSelfNameConfigured(flag, profile?.nickname)) return false
  if (!isValidUserBirthday(profile?.birthday)) return false
  if (!isValidUserGender(profile?.gender)) return false
  return true
}

export function normalizeGraphAwakenNickname(nickname: string | null | undefined): string | null {
  const name = nickname?.trim() ?? ''
  if (!name || isDefaultGraphSelfName(name)) return null
  return name
}

export type GraphAwakenFormInput = {
  nickname: string
  birthday: string
  gender: UserGender | ''
  customGender?: string
}

export type GraphAwakenFormErrors = {
  nickname?: string
  birthday?: string
  gender?: string
}

export function validateGraphAwakenForm(input: GraphAwakenFormInput): GraphAwakenFormErrors {
  const errors: GraphAwakenFormErrors = {}
  if (!normalizeGraphAwakenNickname(input.nickname)) {
    errors.nickname = 'nickname'
  }
  if (!isValidUserBirthday(input.birthday)) {
    errors.birthday = 'birthday'
  }
  if (!isValidUserGender(input.gender)) {
    errors.gender = 'gender'
  }
  return errors
}

export function applyGraphAwakenToProfile(
  profile: UserProfile,
  input: { nickname: string; birthday: string; gender: UserGender; customGender?: string | null }
): UserProfile {
  return {
    ...profile,
    nickname: input.nickname.trim(),
    birthday: input.birthday.trim(),
    gender: input.gender,
    customGender: input.gender === 'other' ? input.customGender?.trim() || null : null
  }
}

export function findGraphSelfPersonHit<
  T extends { name?: string; aliases?: unknown; nodeType?: string }
>(hits: T[] | null | undefined, prevName: string): T | undefined {
  return (hits || []).find((h) => {
    if (h.nodeType && h.nodeType !== 'person') return false
    if (h.name === prevName) return true
    const aliases = Array.isArray(h.aliases) ? h.aliases : []
    return aliases.includes(prevName)
  })
}

export function buildGraphSelfPersonAliases(
  existingAliases: unknown,
  prevName: string,
  nextName: string
): string[] {
  const aliases = new Set<string>([
    ...(Array.isArray(existingAliases) ? (existingAliases as string[]) : []),
    prevName
  ])
  aliases.delete(nextName)
  return [...aliases]
}
