import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import {
  buildWindowsToastShortcutOptions,
  resolveWindowsToastShortcutPath
} from '../windows-toast-identity.util'

describe('windows toast shortcut identity', () => {
  it('should place the start menu shortcut under Programs with the app name', () => {
    expect(resolveWindowsToastShortcutPath('C:/Users/me/AppData/Roaming', '白守 Dev')).toBe(
      join(
        'C:/Users/me/AppData/Roaming',
        'Microsoft',
        'Windows',
        'Start Menu',
        'Programs',
        '白守 Dev.lnk'
      )
    )
  })

  it('should stamp AppUserModelId and skip electron args when packaged', () => {
    const options = buildWindowsToastShortcutOptions({
      execPath: 'C:/Program Files/BaiShou/BaiShou.exe',
      packaged: true,
      argv: ['C:/Program Files/BaiShou/BaiShou.exe', '--hidden'],
      appUserModelId: 'com.baishou.baishou',
      iconPath: 'C:/Program Files/BaiShou/resources/icon.png',
      description: '白守'
    })
    expect(options.target).toBe('C:/Program Files/BaiShou/BaiShou.exe')
    expect(options.args).toBe('')
    expect(options.appUserModelId).toBe('com.baishou.baishou')
    expect(options.icon).toBe('C:/Program Files/BaiShou/resources/icon.png')
  })

  it('should keep electron.exe args when unpackaged so the toast maps to this app', () => {
    const options = buildWindowsToastShortcutOptions({
      execPath: 'D:/electron/electron.exe',
      packaged: false,
      argv: ['D:/electron/electron.exe', 'D:/app/out/main/index.js'],
      appUserModelId: 'com.baishou.baishou.dev',
      description: '白守 Dev'
    })
    expect(options.target).toBe('D:/electron/electron.exe')
    expect(options.args).toContain('D:/app/out/main/index.js')
    expect(options.appUserModelId).toBe('com.baishou.baishou.dev')
  })
})
