import { GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY } from '../constants/graph-self-name.constants'
import {
  DEFAULT_USER_PROFILE,
  USER_PROFILE_LEGACY_SETTINGS_KEY,
  USER_PROFILE_SETTINGS_KEY
} from '../constants/user-profile.constants'
import type { UserProfile, VaultIdentityProfile } from '../types/user-profile.types'
import { normalizeGraphAwakenNickname } from './graph-awaken.util'

export interface UserProfileSettingsStore {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  getActiveVaultId?: () => string | undefined
  getActiveLegacyVaultId?: () => string | undefined
  getAllVaultIds?: () => readonly string[] | undefined
}

export const DEFAULT_VAULT_IDENTITY_PROFILE: VaultIdentityProfile = {
  nickname: DEFAULT_USER_PROFILE.nickname,
  birthday: null,
  gender: null,
  customGender: null,
  showIdentityInProfile: true,
  shareIdentityWithCompanion: true,
  graphSelfNameConfigured: false
}

function hasPersonas(profile: UserProfile | null | undefined): profile is UserProfile {
  return Boolean(profile?.personas && Object.keys(profile.personas).length > 0)
}

/**
 * 判断一份个人身份字段是否包含用户已配置的非默认数据
 */
export function hasLegacyVaultIdentity(
  raw: Partial<UserProfile> | Partial<VaultIdentityProfile> | null | undefined,
  legacyGraphConfiguredFlag?: boolean | null
): boolean {
  if (!raw && !legacyGraphConfiguredFlag) return false
  if (legacyGraphConfiguredFlag) return true
  if (normalizeGraphAwakenNickname(raw?.nickname)) return true
  if (typeof raw?.birthday === 'string' && raw.birthday.trim().length > 0) return true
  if (raw?.gender) return true
  if (typeof raw?.customGender === 'string' && raw.customGender.trim().length > 0) return true
  if (raw?.showIdentityInProfile === false) return true
  if (raw?.shareIdentityWithCompanion === false) return true
  return false
}

/**
 * 从旧版顶层 UserProfile 提取出小窝个人身份对象
 */
export function extractLegacyVaultIdentity(
  raw: Partial<UserProfile> | null | undefined,
  legacyGraphConfiguredFlag?: boolean | null
): VaultIdentityProfile {
  const nickname =
    typeof raw?.nickname === 'string' && raw.nickname.trim()
      ? raw.nickname.trim()
      : DEFAULT_VAULT_IDENTITY_PROFILE.nickname
  const configured =
    typeof legacyGraphConfiguredFlag === 'boolean'
      ? legacyGraphConfiguredFlag
      : Boolean(normalizeGraphAwakenNickname(nickname))
  return {
    nickname,
    birthday: raw?.birthday ?? null,
    gender: raw?.gender ?? null,
    customGender: raw?.customGender ?? null,
    showIdentityInProfile: raw?.showIdentityInProfile ?? true,
    shareIdentityWithCompanion: raw?.shareIdentityWithCompanion ?? true,
    graphSelfNameConfigured: configured
  }
}

/**
 * 确保 UserProfile 的 `vaultProfiles` 字典已初始化：
 * - 当 `raw.vaultProfiles === undefined` 时，若旧版顶层存在已配置身份，则复制到当前所有已知小窝（`activeVaultId` 与 `knownVaultIds`），允许用户在各已有小窝中独立修改；后续新建小窝不在此字典中，保持未唤醒默认状态。
 * - 若旧版为默认未配置状态，则初始化为空字典 `{}`。
 * - 若提供了 `knownVaultIds` 但当前为空数组（例如注册表尚未初始化完成），仅在内存中生成而不标记 `migrated: true` 落盘，待注册表就绪后再一次性写入全部已有小窝。
 */
export function ensureVaultProfilesInitialized(
  raw: UserProfile,
  activeVaultId?: string | null,
  legacyGraphConfiguredFlag?: boolean | null,
  knownVaultIds?: readonly string[] | null
): { profile: UserProfile; migrated: boolean } {
  const trimmedVaultId = activeVaultId?.trim() || ''
  if (!trimmedVaultId) {
    return { profile: raw, migrated: false }
  }
  if (
    raw.vaultProfiles !== undefined &&
    raw.vaultProfiles !== null &&
    typeof raw.vaultProfiles === 'object'
  ) {
    return { profile: raw, migrated: false }
  }
  const vaultProfiles: Record<string, VaultIdentityProfile> = {}
  if (hasLegacyVaultIdentity(raw, legacyGraphConfiguredFlag)) {
    const legacyIdentity = extractLegacyVaultIdentity(raw, legacyGraphConfiguredFlag)
    const targetIds = new Set<string>([trimmedVaultId])
    for (const id of knownVaultIds ?? []) {
      const trimmed = id?.trim()
      if (trimmed) targetIds.add(trimmed)
    }
    for (const id of targetIds) {
      vaultProfiles[id] = { ...legacyIdentity }
    }
  }
  const registryReady =
    knownVaultIds === undefined || knownVaultIds === null || knownVaultIds.length > 0
  return {
    profile: {
      ...raw,
      vaultProfiles
    },
    migrated: registryReady
  }
}

/**
 * 对齐初始化注册表前的确定性小窝 ID（`deriveLegacyVaultId(name)`）与正式分配的 `vlt_...` ID：
 * 当正式 ID 尚未配置有效身份、而同名的确定性旧 ID 已保存过身份时，迁移到正式 ID。
 */
export function alignVaultProfileLegacyKey(
  raw: UserProfile,
  activeVaultId?: string | null,
  legacyVaultId?: string | null
): { profile: UserProfile; aligned: boolean } {
  const trimmedActive = activeVaultId?.trim() || ''
  const trimmedLegacy = legacyVaultId?.trim() || ''
  if (
    !trimmedActive ||
    !trimmedLegacy ||
    trimmedActive === trimmedLegacy ||
    !raw.vaultProfiles ||
    typeof raw.vaultProfiles !== 'object'
  ) {
    return { profile: raw, aligned: false }
  }

  const legacyEntry = raw.vaultProfiles[trimmedLegacy]
  if (!legacyEntry) {
    return { profile: raw, aligned: false }
  }

  const activeEntry = raw.vaultProfiles[trimmedActive]
  const activeHasIdentity =
    activeEntry !== undefined &&
    hasLegacyVaultIdentity(activeEntry, activeEntry.graphSelfNameConfigured)

  const nextVaultProfiles: Record<string, VaultIdentityProfile> = { ...raw.vaultProfiles }
  if (!activeHasIdentity) {
    nextVaultProfiles[trimmedActive] = legacyEntry
  }
  delete nextVaultProfiles[trimmedLegacy]

  return {
    profile: {
      ...raw,
      vaultProfiles: nextVaultProfiles
    },
    aligned: true
  }
}

/**
 * 解析指定小窝（`vaultId`）视图下的完整 `UserProfile`
 */
export function resolveUserProfileForVault(
  raw: UserProfile | null | undefined,
  vaultId?: string | null,
  legacyVaultId?: string | null
): UserProfile {
  const base: UserProfile = hasPersonas(raw)
    ? { ...DEFAULT_USER_PROFILE, ...raw }
    : { ...DEFAULT_USER_PROFILE }

  const trimmedVaultId = vaultId?.trim() || ''
  const trimmedLegacyId = legacyVaultId?.trim() || ''
  if (!trimmedVaultId) {
    return base
  }

  if (base.vaultProfiles && typeof base.vaultProfiles === 'object') {
    const entry =
      base.vaultProfiles[trimmedVaultId] ??
      (trimmedLegacyId ? base.vaultProfiles[trimmedLegacyId] : undefined)
    const resolvedIdentity: VaultIdentityProfile = entry
      ? extractLegacyVaultIdentity(entry, entry.graphSelfNameConfigured)
      : { ...DEFAULT_VAULT_IDENTITY_PROFILE }
    const { graphSelfNameConfigured: _ignored, ...identityFields } = resolvedIdentity
    return { ...base, ...identityFields }
  }

  if (hasLegacyVaultIdentity(base)) {
    return base
  }

  const { graphSelfNameConfigured: _ignored, ...defaultFields } = DEFAULT_VAULT_IDENTITY_PROFILE
  return { ...base, ...defaultFields }
}

export interface MergeVaultIdentityOptions {
  legacyVaultId?: string | null
  legacyGraphConfiguredFlag?: boolean | null
  graphSelfNameConfigured?: boolean
  knownVaultIds?: readonly string[] | null
}

/**
 * 将针对 `vaultId` 的个人资料修改合并回存储层 `UserProfile`，保留其他小窝的独立资料与全局字段。
 */
export function mergeVaultIdentityIntoUserProfile(
  existingRaw: UserProfile | null | undefined,
  incoming: Partial<UserProfile>,
  vaultId?: string | null,
  options?: MergeVaultIdentityOptions
): UserProfile {
  const base: UserProfile = hasPersonas(existingRaw)
    ? { ...DEFAULT_USER_PROFILE, ...existingRaw }
    : { ...DEFAULT_USER_PROFILE }

  const trimmedVaultId = vaultId?.trim() || ''
  if (!trimmedVaultId) {
    return {
      ...base,
      ...incoming,
      personas:
        incoming.personas && Object.keys(incoming.personas).length > 0
          ? incoming.personas
          : base.personas,
      activePersonaId: incoming.activePersonaId || base.activePersonaId
    }
  }

  const { profile: initialized } = ensureVaultProfilesInitialized(
    base,
    trimmedVaultId,
    options?.legacyGraphConfiguredFlag,
    options?.knownVaultIds
  )
  const { profile: aligned } = alignVaultProfileLegacyKey(
    initialized,
    trimmedVaultId,
    options?.legacyVaultId
  )

  const existingVaultProfiles = aligned.vaultProfiles ?? {}
  const existingEntry = existingVaultProfiles[trimmedVaultId]

  const incomingHasIdentityFields =
    incoming.nickname !== undefined ||
    incoming.birthday !== undefined ||
    incoming.gender !== undefined ||
    incoming.customGender !== undefined ||
    incoming.showIdentityInProfile !== undefined ||
    incoming.shareIdentityWithCompanion !== undefined

  const nextNickname =
    typeof incoming.nickname === 'string' && incoming.nickname.trim()
      ? incoming.nickname.trim()
      : (existingEntry?.nickname ?? DEFAULT_VAULT_IDENTITY_PROFILE.nickname)
  const nextConfigured =
    options?.graphSelfNameConfigured !== undefined
      ? options.graphSelfNameConfigured
      : normalizeGraphAwakenNickname(nextNickname)
        ? true
        : (existingEntry?.graphSelfNameConfigured ?? false)

  const nextEntry: VaultIdentityProfile = {
    nickname: nextNickname,
    birthday:
      incoming.birthday !== undefined ? incoming.birthday : (existingEntry?.birthday ?? null),
    gender: incoming.gender !== undefined ? incoming.gender : (existingEntry?.gender ?? null),
    customGender:
      incoming.customGender !== undefined
        ? incoming.customGender
        : (existingEntry?.customGender ?? null),
    showIdentityInProfile:
      incoming.showIdentityInProfile !== undefined
        ? incoming.showIdentityInProfile
        : (existingEntry?.showIdentityInProfile ?? true),
    shareIdentityWithCompanion:
      incoming.shareIdentityWithCompanion !== undefined
        ? incoming.shareIdentityWithCompanion
        : (existingEntry?.shareIdentityWithCompanion ?? true),
    graphSelfNameConfigured: nextConfigured
  }

  const nextVaultProfiles: Record<string, VaultIdentityProfile> = {
    ...existingVaultProfiles,
    ...(incoming.vaultProfiles ?? {})
  }

  if (
    existingEntry !== undefined ||
    options?.graphSelfNameConfigured !== undefined ||
    (incomingHasIdentityFields && hasLegacyVaultIdentity(nextEntry, nextConfigured))
  ) {
    nextVaultProfiles[trimmedVaultId] = nextEntry
  }

  const mergedGlobal: UserProfile = {
    ...aligned,
    ...incoming,
    personas:
      incoming.personas && Object.keys(incoming.personas).length > 0
        ? incoming.personas
        : aligned.personas,
    activePersonaId: incoming.activePersonaId || aligned.activePersonaId,
    nickname: nextEntry.nickname,
    birthday: nextEntry.birthday,
    gender: nextEntry.gender,
    customGender: nextEntry.customGender,
    showIdentityInProfile: nextEntry.showIdentityInProfile,
    shareIdentityWithCompanion: nextEntry.shareIdentityWithCompanion,
    vaultProfiles: nextVaultProfiles
  }

  return mergedGlobal
}

/**
 * 判断指定小窝是否已完成图谱自称确认（唤醒）
 */
export function isVaultGraphSelfNameConfigured(
  raw: UserProfile | null | undefined,
  vaultId?: string | null,
  legacyGraphConfiguredFlag?: boolean | null,
  legacyVaultId?: string | null
): boolean {
  const trimmedVaultId = vaultId?.trim() || ''
  const trimmedLegacyId = legacyVaultId?.trim() || ''
  if (!trimmedVaultId) {
    return (
      Boolean(legacyGraphConfiguredFlag) || Boolean(normalizeGraphAwakenNickname(raw?.nickname))
    )
  }

  if (raw?.vaultProfiles && typeof raw.vaultProfiles === 'object') {
    const entry =
      raw.vaultProfiles[trimmedVaultId] ??
      (trimmedLegacyId ? raw.vaultProfiles[trimmedLegacyId] : undefined)
    if (!entry) return false
    return (
      Boolean(entry.graphSelfNameConfigured) ||
      Boolean(normalizeGraphAwakenNickname(entry.nickname))
    )
  }

  return Boolean(legacyGraphConfiguredFlag) || Boolean(normalizeGraphAwakenNickname(raw?.nickname))
}

/**
 * 将移动端历史键 `user_profile` 迁移到 canonical 键 `user_profile_data`。
 * @returns 是否写入了 SQLite（含删除 legacy 键）
 */
export async function migrateUserProfileSettingsKey(
  store: UserProfileSettingsStore
): Promise<boolean> {
  let changed = false

  const canonical = await store.get<UserProfile>(USER_PROFILE_SETTINGS_KEY)
  const legacy = await store.get<UserProfile>(USER_PROFILE_LEGACY_SETTINGS_KEY)

  if (!hasPersonas(canonical) && hasPersonas(legacy)) {
    await store.set(USER_PROFILE_SETTINGS_KEY, legacy)
    changed = true
  }

  if (legacy) {
    await store.delete(USER_PROFILE_LEGACY_SETTINGS_KEY)
    changed = true
  }

  return changed
}

type PartialProfileStore = Pick<UserProfileSettingsStore, 'get'> &
  Partial<
    Pick<
      UserProfileSettingsStore,
      'set' | 'getActiveVaultId' | 'getActiveLegacyVaultId' | 'getAllVaultIds'
    >
  >

async function loadAndMigrateVaultProfileRecord(
  store: PartialProfileStore,
  options?: {
    vaultId?: string
    legacyVaultId?: string
    legacyGraphConfiguredFlag?: boolean | null
  }
): Promise<{
  raw: UserProfile | null
  current: UserProfile
  targetVaultId: string
  legacyVaultId: string
  legacyFlag: boolean | null
}> {
  const targetVaultId = options?.vaultId?.trim() || store.getActiveVaultId?.()?.trim() || ''
  const legacyVaultId =
    options?.legacyVaultId?.trim() || store.getActiveLegacyVaultId?.()?.trim() || ''
  const knownVaultIds = store.getAllVaultIds?.()
  const raw = await store.get<UserProfile>(USER_PROFILE_SETTINGS_KEY)
  const readLegacyFlag = async (): Promise<boolean | null> =>
    options && 'legacyGraphConfiguredFlag' in options
      ? (options.legacyGraphConfiguredFlag ?? null)
      : await store.get<boolean>(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY)

  const base = hasPersonas(raw) ? raw : DEFAULT_USER_PROFILE
  if (!targetVaultId) {
    return {
      raw,
      current: base,
      targetVaultId: '',
      legacyVaultId,
      legacyFlag: await readLegacyFlag()
    }
  }

  let current = base
  let dirty = false
  let legacyFlag: boolean | null = null

  if (current.vaultProfiles === undefined) {
    legacyFlag = await readLegacyFlag()
    const { profile: initialized, migrated } = ensureVaultProfilesInitialized(
      current,
      targetVaultId,
      legacyFlag,
      knownVaultIds
    )
    current = initialized
    dirty = dirty || migrated
  }

  const { profile: aligned, aligned: didAlign } = alignVaultProfileLegacyKey(
    current,
    targetVaultId,
    legacyVaultId
  )
  current = aligned
  dirty = dirty || didAlign

  if (dirty && hasPersonas(raw) && typeof store.set === 'function') {
    await store.set(USER_PROFILE_SETTINGS_KEY, current)
  }

  return { raw, current, targetVaultId, legacyVaultId, legacyFlag }
}

/** 读取用户档案；当存在 vaultId 时按小窝隔离解析并自动完成旧数据向全部已有小窝的首次迁移 */
export async function getUserProfileFromSettings(
  store: PartialProfileStore,
  vaultId?: string
): Promise<UserProfile> {
  const { raw, current, targetVaultId, legacyVaultId } = await loadAndMigrateVaultProfileRecord(
    store,
    { vaultId }
  )
  if (!targetVaultId) {
    return hasPersonas(raw) ? raw : DEFAULT_USER_PROFILE
  }
  if (!hasPersonas(raw)) {
    return resolveUserProfileForVault(DEFAULT_USER_PROFILE, targetVaultId, legacyVaultId)
  }
  return resolveUserProfileForVault(current, targetVaultId, legacyVaultId)
}

type WritableProfileStore = Pick<UserProfileSettingsStore, 'set'> &
  Partial<
    Pick<
      UserProfileSettingsStore,
      'get' | 'getActiveVaultId' | 'getActiveLegacyVaultId' | 'getAllVaultIds'
    >
  >

/** 保存用户档案到 canonical 键；当存在 vaultId 时只更新对应小窝的个人身份并保留其他小窝数据 */
export async function saveUserProfileToSettings(
  store: WritableProfileStore,
  profile: UserProfile,
  vaultId?: string
): Promise<void> {
  const targetVaultId = vaultId?.trim() || store.getActiveVaultId?.()?.trim() || ''
  if (!targetVaultId || typeof store.get !== 'function') {
    await store.set(USER_PROFILE_SETTINGS_KEY, profile)
    return
  }

  const existingRaw = await store.get<UserProfile>(USER_PROFILE_SETTINGS_KEY)
  const legacyFlag =
    existingRaw?.vaultProfiles === undefined
      ? await store.get<boolean>(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY)
      : null

  const merged = mergeVaultIdentityIntoUserProfile(existingRaw, profile, targetVaultId, {
    legacyVaultId: store.getActiveLegacyVaultId?.()?.trim() || '',
    legacyGraphConfiguredFlag: legacyFlag,
    knownVaultIds: store.getAllVaultIds?.()
  })
  await store.set(USER_PROFILE_SETTINGS_KEY, merged)
}

/** 读取指定小窝的图谱自称已确认标记 */
export async function getVaultGraphSelfNameConfigured(
  store: PartialProfileStore,
  options?: {
    vaultId?: string
    legacyVaultId?: string
    legacyGraphConfiguredFlag?: boolean | null
  }
): Promise<boolean> {
  const { raw, current, targetVaultId, legacyVaultId, legacyFlag } =
    await loadAndMigrateVaultProfileRecord(store, options)
  if (!targetVaultId) {
    return isVaultGraphSelfNameConfigured(raw, '', legacyFlag)
  }
  return isVaultGraphSelfNameConfigured(current, targetVaultId, legacyFlag, legacyVaultId)
}

/** 写入指定小窝的图谱自称已确认标记 */
export async function setVaultGraphSelfNameConfigured(
  store: Pick<UserProfileSettingsStore, 'get' | 'set'> &
    Partial<
      Pick<
        UserProfileSettingsStore,
        'getActiveVaultId' | 'getActiveLegacyVaultId' | 'getAllVaultIds'
      >
    >,
  configured: boolean,
  options?: {
    vaultId?: string
    legacyVaultId?: string
    legacyGraphConfiguredFlag?: boolean | null
  }
): Promise<void> {
  const targetVaultId = options?.vaultId?.trim() || store.getActiveVaultId?.()?.trim() || ''
  if (!targetVaultId) {
    await store.set(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY, configured)
    return
  }

  const existingRaw = await store.get<UserProfile>(USER_PROFILE_SETTINGS_KEY)
  const legacyFlag =
    existingRaw?.vaultProfiles === undefined
      ? options && 'legacyGraphConfiguredFlag' in options
        ? (options.legacyGraphConfiguredFlag ?? null)
        : await store.get<boolean>(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY)
      : null

  const merged = mergeVaultIdentityIntoUserProfile(existingRaw, {}, targetVaultId, {
    legacyVaultId: options?.legacyVaultId?.trim() || store.getActiveLegacyVaultId?.()?.trim() || '',
    legacyGraphConfiguredFlag: legacyFlag,
    graphSelfNameConfigured: configured,
    knownVaultIds: store.getAllVaultIds?.()
  })
  await store.set(USER_PROFILE_SETTINGS_KEY, merged)
}
