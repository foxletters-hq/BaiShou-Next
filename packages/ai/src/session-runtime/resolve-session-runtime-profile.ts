import type { AgentSessionKind, SessionRuntimeProfile } from '@baishou/shared'
import { clampMaxSteps } from './guards'

export interface ResolveSessionRuntimeProfileOptions {
  sessionRuntimeV2?: boolean
  maxSteps?: number
  doomLoopThreshold?: number
  interruptOnGateReject?: boolean
}

export interface ResolveSessionRuntimeProfileInput {
  sessionKind?: AgentSessionKind
  userConfig?: unknown
  options?: ResolveSessionRuntimeProfileOptions
}

function configFlag(config: unknown, key: string): boolean {
  if (!config || typeof config !== 'object') return false
  const v = (config as Record<string, unknown>)[key]
  return v === true || v === 'true' || v === 1
}

function configFlagExplicitFalse(config: unknown, key: string): boolean {
  if (!config || typeof config !== 'object') return false
  const v = (config as Record<string, unknown>)[key]
  return v === false || v === 'false' || v === 0
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function resolveSessionRuntimeV2(
  sessionKind: AgentSessionKind | undefined,
  userConfig: unknown,
  optionOverride: boolean | undefined
): boolean {
  const explicitFalse =
    optionOverride === false ||
    configFlagExplicitFalse(userConfig, 'sessionRuntimeV2') ||
    configFlagExplicitFalse(userConfig, 'sessionRuntime.v2')
  if (explicitFalse) return false

  if (
    optionOverride === true ||
    configFlag(userConfig, 'sessionRuntimeV2') ||
    configFlag(userConfig, 'sessionRuntime.v2')
  ) {
    return true
  }

  // workspace 默认开；companion（及未标明）默认关
  return sessionKind === 'workspace'
}

function resolveMaxSteps(userConfig: unknown, optionOverride: number | undefined): number {
  const fromConfig = readFiniteNumber(
    userConfig && typeof userConfig === 'object'
      ? (userConfig as Record<string, unknown>)['maxSteps']
      : undefined
  )
  return clampMaxSteps(optionOverride ?? fromConfig, 10)
}

function resolveDoomLoopThreshold(
  userConfig: unknown,
  optionOverride: number | undefined
): number {
  const fromConfig = readFiniteNumber(
    userConfig && typeof userConfig === 'object'
      ? (userConfig as Record<string, unknown>)['doomLoopThreshold']
      : undefined
  )
  const raw = optionOverride ?? fromConfig
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(2, Math.min(20, Math.trunc(raw)))
  }
  return 3
}

/**
 * 统一解析 SessionRuntimeProfile：按 sessionKind 收口默认，显式 false 优先。
 */
export function resolveSessionRuntimeProfile(
  input: ResolveSessionRuntimeProfileInput
): SessionRuntimeProfile {
  const sessionKind = input.sessionKind
  const userConfig = input.userConfig
  const options = input.options

  const sessionRuntimeV2 = resolveSessionRuntimeV2(
    sessionKind,
    userConfig,
    options?.sessionRuntimeV2
  )
  const maxSteps = resolveMaxSteps(userConfig, options?.maxSteps)
  const doomLoopThreshold = resolveDoomLoopThreshold(userConfig, options?.doomLoopThreshold)
  const interruptOnGateReject =
    options?.interruptOnGateReject === true ||
    sessionRuntimeV2 ||
    sessionKind === 'workspace' ||
    configFlag(userConfig, 'interruptOnGateReject')

  return {
    sessionKind,
    sessionRuntimeV2,
    maxSteps,
    doomLoopThreshold,
    interruptOnGateReject
  }
}
