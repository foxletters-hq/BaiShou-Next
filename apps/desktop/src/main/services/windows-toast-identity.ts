import { existsSync } from 'node:fs'
import { app, shell } from 'electron'
import { logger } from '@baishou/shared'
import { DESKTOP_APP_ID, DESKTOP_DEV_APP_ID, isDesktopDevBuild } from '../app-identity'
import {
  buildWindowsToastShortcutOptions,
  resolveWindowsToastShortcutPath
} from './windows-toast-identity.util'

let ensured = false
let iconPath: string | undefined

function resolveUnpackedIconPath(rawPath: string | undefined): string | undefined {
  if (!rawPath) return undefined
  if (/app\.asar[\\/]/i.test(rawPath) && !/app\.asar\.unpacked[\\/]/i.test(rawPath)) {
    const unpacked = rawPath.replace(/app\.asar([\\/])/i, 'app.asar.unpacked$1')
    if (existsSync(unpacked)) return unpacked
  }
  return existsSync(rawPath) ? rawPath : undefined
}

function resolveWindowsShortcutIconPath(
  execPath: string,
  packaged: boolean,
  rawIconPath: string | undefined
): string {
  if (packaged) return execPath
  const resolved = resolveUnpackedIconPath(rawIconPath)
  if (resolved && /\.(?:ico|exe|dll)$/i.test(resolved)) {
    return resolved
  }
  return execPath
}

export function setWindowsToastIconPath(path: string | undefined): void {
  iconPath = path
}

export function getWindowsToastIconPath(): string | undefined {
  return resolveUnpackedIconPath(iconPath)
}

export function desktopToastAppUserModelId(): string {
  return isDesktopDevBuild() ? DESKTOP_DEV_APP_ID : DESKTOP_APP_ID
}

/**
 * Windows Toast 要求开始菜单快捷方式带上与进程相同的 AppUserModelId。
 * 开发态 electron.exe 与旧安装包快捷方式往往缺这项，通知会静默失败。
 */
export function ensureWindowsToastShortcut(): void {
  if (process.platform !== 'win32') return
  if (typeof app?.setAppUserModelId === 'function') {
    app.setAppUserModelId(desktopToastAppUserModelId())
  }
  if (ensured) return
  if (typeof shell?.writeShortcutLink !== 'function' || typeof app?.getPath !== 'function') return
  try {
    const shortcutPath = resolveWindowsToastShortcutPath(app.getPath('appData'), app.getName())
    const options = buildWindowsToastShortcutOptions({
      execPath: process.execPath,
      packaged: app.isPackaged,
      argv: process.argv,
      appUserModelId: desktopToastAppUserModelId(),
      iconPath: resolveWindowsShortcutIconPath(process.execPath, app.isPackaged, iconPath),
      description: app.getName()
    })
    const operation = existsSync(shortcutPath) ? 'replace' : 'create'
    const ok = shell.writeShortcutLink(shortcutPath, operation, options)
    if (ok) ensured = true
    else logger.warn('[WindowsToast] writeShortcutLink returned false')
  } catch (error) {
    logger.warn('[WindowsToast] shortcut ensure failed', { error })
  }
}
