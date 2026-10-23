import { requireNativeModule } from 'expo-modules-core'
import i18n from 'i18next'

import type { ExpoBaishouServerModule } from './expo-baishou-server.types'

/** 缺原生实现时的统一提示。各能力文件共用这一处，避免每条 API 各写一套重建说明。 */
export const NATIVE_REBUILD_HINT = i18n.t(
  'auto.apps.mobile.modules.expo.baishou.server.index.L114',
  'ExpoBaishouServer 原生模块未编入或版本过旧。请执行 pnpm dev:mobile:clear 重新安装开发版（不可用 Expo Go）。'
)

let nativeModule: ExpoBaishouServerModule | null | undefined

/** 缓存 require 结果。原生模块进程内只存在一份，重复 require 会掩盖「未编入」与「已加载」的区别。 */
export function getNative(): ExpoBaishouServerModule | null {
  if (nativeModule !== undefined) return nativeModule
  try {
    nativeModule = requireNativeModule<ExpoBaishouServerModule>('ExpoBaishouServer')
  } catch {
    nativeModule = null
  }
  return nativeModule
}

export function requireNative(): ExpoBaishouServerModule {
  const mod = getNative()
  if (!mod) {
    throw new Error(NATIVE_REBUILD_HINT)
  }
  return mod
}

/**
 * 外部存储 API 必须先确认当前 APK 带了 externalMakeDirectory。
 * 旧包只有 MCP 服务、没有文件桥时，直接调会变成难读的 method missing。
 */
export function callNativeExternal<T>(op: string, fn: (mod: ExpoBaishouServerModule) => T): T {
  const mod = requireNative()
  if (typeof mod.externalMakeDirectory !== 'function') {
    throw new Error(`${NATIVE_REBUILD_HINT}（缺少外部存储 API：${op}）`)
  }
  try {
    return fn(mod)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`${op} failed: ${msg}`)
  }
}
