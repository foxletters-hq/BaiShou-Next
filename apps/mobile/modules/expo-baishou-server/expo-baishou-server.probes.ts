import { getNative } from './expo-baishou-server.native'
import type {
  MirrorProductionLegacyResult,
  StoragePermissionState
} from './expo-baishou-server.types'

/**
 * 能力探测与权限/旧版数据入口。
 * 只读 getNative、不抛「未编入」：设置页和启动路径要在缺原生模块时显示降级，而不是直接崩溃。
 */

export function isBaishouServerAvailable(): boolean {
  return getNative() != null
}

/** 当前 APK 是否包含外部存储文件 API（与 MCP 服务无关） */
export function isExternalStorageNativeAvailable(): boolean {
  const mod = getNative()
  return mod != null && typeof mod.externalMakeDirectory === 'function'
}

/** 当前 APK 是否包含沙盒本地路径 java.io.File API（localGetInfo / localReadDirectory） */
export function isLocalFsNativeAvailable(): boolean {
  const mod = getNative()
  return mod != null && typeof mod.localGetInfo === 'function'
}

/** 当前 APK 是否包含原生归档解压/复制 API */
export function isNativeArchiveImportAvailable(): boolean {
  const mod = getNative()
  return mod != null && typeof mod.nativeUnzipArchive === 'function'
}

/** 当前 APK 是否包含整棵存储根流式迁移 API（旧版升级复制） */
export function isNativeStorageRootMigrationAvailable(): boolean {
  const mod = getNative()
  return mod != null && typeof mod.nativeCopyStorageRootAsync === 'function'
}

export function isNativeArchiveExportAvailable(): boolean {
  const mod = getNative()
  return mod != null && typeof mod.nativeZipArchiveExport === 'function'
}

export function isLanUploadNativeAvailable(): boolean {
  const mod = getNative()
  return mod != null && typeof mod.uploadLanFileAsync === 'function'
}

export function isReadFileChunkNativeAvailable(): boolean {
  const mod = getNative()
  return mod != null && typeof mod.readFileChunkBase64 === 'function'
}

export function isHttpFileUploadNativeAvailable(): boolean {
  const mod = getNative()
  return mod != null && typeof mod.httpUploadFileAsync === 'function'
}

export function isNativeDirectoryPickerAvailable(): boolean {
  const mod = getNative()
  return mod != null && typeof mod.pickDirectoryAsync === 'function'
}

export function hasAllFilesAccess(): boolean {
  const mod = getNative()
  if (!mod) return false
  try {
    return mod.hasAllFilesAccess()
  } catch {
    return false
  }
}

export function openAllFilesAccessSettings(): boolean {
  const mod = getNative()
  if (!mod) return false
  try {
    return mod.openAllFilesAccessSettings()
  } catch {
    return false
  }
}

/** xiaomi | huawei | oppo | vivo | samsung | generic */
export function getStoragePermissionOemKey(): string {
  const mod = getNative()
  if (!mod || typeof mod.getStoragePermissionOemKey !== 'function') return 'generic'
  try {
    return mod.getStoragePermissionOemKey() || 'generic'
  } catch {
    return 'generic'
  }
}

export function probeExternalStorageWritable(): boolean {
  const mod = getNative()
  if (!mod || typeof mod.probeExternalStorageWritable !== 'function') return false
  try {
    return mod.probeExternalStorageWritable()
  } catch {
    return false
  }
}

export function getStoragePermissionState(): StoragePermissionState {
  const mod = getNative()
  const empty: StoragePermissionState = {
    allFilesManager: false,
    appOpsAllFiles: false,
    standardStorage: false,
    probeWritable: false,
    safTree: false,
    effectiveAccess: false
  }
  if (!mod || typeof mod.getStoragePermissionState !== 'function') return empty
  try {
    const raw = mod.getStoragePermissionState() ?? {}
    return {
      allFilesManager: Boolean(raw.allFilesManager),
      appOpsAllFiles: Boolean(raw.appOpsAllFiles),
      standardStorage: Boolean(raw.standardStorage),
      probeWritable: Boolean(raw.probeWritable),
      safTree: Boolean(raw.safTree),
      effectiveAccess: Boolean(raw.effectiveAccess)
    }
  } catch {
    return empty
  }
}

export function getLegacyFlutterStorageRoots(): string[] {
  const mod = getNative()
  if (!mod || typeof mod.getLegacyFlutterStorageRoots !== 'function') return []
  try {
    return mod.getLegacyFlutterStorageRoots() ?? []
  } catch {
    return []
  }
}

export function readLegacyFlutterSharedPreferencesXml(): string | null {
  const mod = getNative()
  if (!mod || typeof mod.readLegacyFlutterSharedPreferencesXml !== 'function') return null
  try {
    return mod.readLegacyFlutterSharedPreferencesXml() ?? null
  } catch {
    return null
  }
}

export function getLegacyFlutterAvatarsDirectory(): string | null {
  const mod = getNative()
  if (!mod || typeof mod.getLegacyFlutterAvatarsDirectory !== 'function') return null
  try {
    return mod.getLegacyFlutterAvatarsDirectory() ?? null
  } catch {
    return null
  }
}

/** Dev 包：尝试把正式包沙盒内的 BaiShou_Root 复制到外部存储 */
export function mirrorProductionLegacyToExternal(): MirrorProductionLegacyResult {
  const mod = getNative()
  if (!mod || typeof mod.mirrorProductionLegacyToExternal !== 'function') {
    return { mirrored: false, reason: 'native_unavailable' }
  }
  try {
    return (mod.mirrorProductionLegacyToExternal() ?? {
      mirrored: false
    }) as MirrorProductionLegacyResult
  } catch {
    return { mirrored: false, reason: 'native_error' }
  }
}
