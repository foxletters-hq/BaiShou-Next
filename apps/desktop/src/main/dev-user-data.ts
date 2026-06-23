import { app } from 'electron'
import { join, relative, resolve, isAbsolute } from 'path'

/** 开发版（未打包）专用的应用配置目录名，与稳定版 `%APPDATA%\\白守` 隔离 */
export const DEV_USER_DATA_DIR_NAME = '白守-dev'

/**
 * 计算开发版 userData 路径（纯函数，便于单测）。
 * @param appData Electron 的 appData 根（Windows 一般为 %APPDATA%）
 */
export function resolveDevUserDataPath(appData: string): string {
  return join(appData, DEV_USER_DATA_DIR_NAME)
}

/** 未打包的 electron-vite / npm run dev 运行时为 true；正式安装包为 false */
export function isDesktopDevRuntime(): boolean {
  return !app.isPackaged
}

/** 开发版是否允许挂载 userData 之外的数据根（需显式设环境变量） */
export function isDevExternalStorageAllowed(): boolean {
  return process.env.BAISHOU_DEV_ALLOW_EXTERNAL_ROOT === '1'
}

/** 数据根是否位于当前 userData 目录树下 */
export function isStorageRootWithinUserData(storageRoot: string, userData: string): boolean {
  const rel = relative(resolve(userData), resolve(storageRoot))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/**
 * 开发版仅使用隔离 userData 内的 Vaults，忽略误指向生产目录的 custom_storage_root。
 * 若确需在 dev 调试生产数据，启动前设置 BAISHOU_DEV_ALLOW_EXTERNAL_ROOT=1。
 */
export function resolveDevEffectiveStorageRoot(customStorageRoot: string): string {
  const trimmed = customStorageRoot.trim()
  if (!trimmed) return resolveDefaultDevStorageRoot()
  if (isDevExternalStorageAllowed()) return trimmed
  if (isStorageRootWithinUserData(trimmed, app.getPath('userData'))) return trimmed
  return resolveDefaultDevStorageRoot()
}

/**
 * 开发版 custom_storage_root 被纠正为 dev Vaults 时返回 true（调用方应写回 settings）。
 */
export function shouldRewriteDevStorageRoot(customStorageRoot: string): boolean {
  const trimmed = customStorageRoot.trim()
  if (!trimmed || isDevExternalStorageAllowed()) return false
  return !isStorageRootWithinUserData(trimmed, app.getPath('userData'))
}

/** 开发版默认数据根：落在隔离的 userData 下，不与稳定版工作区混用 */
export function resolveDefaultDevStorageRoot(): string {
  return join(app.getPath('userData'), 'Vaults')
}

/**
 * 未打包时把 userData 指到独立目录，避免与已安装的稳定版共用 baishou_settings、影子索引等。
 * 须在 app.ready 之前、main 进程其它逻辑之前调用。
 */
export function configureDevUserDataDirectory(): void {
  if (app.isPackaged) return

  const devUserData = resolveDevUserDataPath(app.getPath('appData'))
  app.setPath('userData', devUserData)

  if (process.env.NODE_ENV !== 'test') {
    console.info(`[Dev] userData → ${devUserData}`)
  }
}
