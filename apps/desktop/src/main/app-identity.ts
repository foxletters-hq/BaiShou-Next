import { app } from 'electron'
import { join } from 'path'

export const DESKTOP_APP_ID = 'com.baishou.baishou'
export const DESKTOP_DEV_APP_ID = 'com.baishou.baishou.dev'

// 应用显示名与数据目录名，非 UI 文案，不做 i18n
export const DESKTOP_APP_NAME = '白守'
export const DESKTOP_DEV_APP_NAME = '白守 Dev'

/** 开发模式（electron-vite dev / 未打包运行） */
export function isDesktopDevBuild(): boolean {
  return !app.isPackaged
}

/**
 * 在 app.ready 之前配置应用身份，使开发端与稳定端使用独立的 userData。
 * 与移动端 com.baishou.baishou.dev 并存策略一致。
 */
export function configureDesktopAppIdentity(): void {
  // 早启动 / 测试环境下 electron app 可能为部分 mock，缺方法时安全跳过
  if (typeof app?.setName !== 'function') return

  if (app.isPackaged) {
    app.setName(DESKTOP_APP_NAME)
    return
  }

  app.setName(DESKTOP_DEV_APP_NAME)
  if (typeof app.getPath === 'function' && typeof app.setPath === 'function') {
    const devUserData = join(app.getPath('appData'), DESKTOP_DEV_APP_NAME)
    app.setPath('userData', devUserData)
  }
}

configureDesktopAppIdentity()
