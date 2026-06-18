import { Platform, PermissionsAndroid } from 'react-native'
import { ExternalStorageRequiredError } from './storage-required.error'
import i18n from 'i18next'
import * as Application from 'expo-application'
import * as IntentLauncher from 'expo-intent-launcher'
import {
  hasAllFilesAccess as nativeHasAllFilesAccess,
  isBaishouServerAvailable,
  isExternalStorageNativeAvailable,
  openAllFilesAccessSettings as nativeOpenAllFilesAccessSettings,
  getStoragePermissionOemKey as nativeGetStoragePermissionOemKey,
  getStoragePermissionState as nativeGetStoragePermissionState,
  probeExternalStorageWritable,
  type StoragePermissionState
} from 'expo-baishou-server'

export type { StoragePermissionState }

/** 与桌面端 / 旧版 BaiShou 一致的外部数据根目录 */
export const EXTERNAL_STORAGE_ROOT = '/storage/emulated/0/BaiShou_Root'

/** 展示 / 深链用 file URI */
export const EXTERNAL_STORAGE_ROOT_URI = `file://${EXTERNAL_STORAGE_ROOT}`

/**
 * 检查外部存储是否可用（全文件访问 / SAF 目录树 / 实际可写探测）。
 * realme 等 ROM 上「存储空间」开关不等于「允许管理所有文件」。
 */
export async function hasStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true

  if (!isBaishouServerAvailable() || !isExternalStorageNativeAvailable()) {
    return false
  }

  return nativeHasAllFilesAccess()
}

/** 探测外部 BaiShou_Root 是否可写（挂载/写入前使用） */
export async function canWriteExternalStorage(): Promise<boolean> {
  if (Platform.OS !== 'android') return true
  if (!isBaishouServerAvailable() || !isExternalStorageNativeAvailable()) {
    return false
  }
  return probeExternalStorageWritable()
}

export function readStoragePermissionState(): StoragePermissionState {
  if (Platform.OS !== 'android') {
    return {
      allFilesManager: true,
      appOpsAllFiles: true,
      standardStorage: true,
      probeWritable: true,
      safTree: false,
      effectiveAccess: true
    }
  }
  return nativeGetStoragePermissionState()
}

/** 按当前权限状态返回更具体的引导文案 key 对应文本 */
export function getStoragePermissionHint(state?: StoragePermissionState): string {
  const s = state ?? readStoragePermissionState()
  if (s.effectiveAccess || s.probeWritable || s.safTree) {
    return ''
  }
  if (s.standardStorage && !s.allFilesManager && !s.appOpsAllFiles) {
    const oem = getStoragePermissionOemKey()
    if (oem === 'oppo') {
      return i18n.t('storage.only_standard_storage_granted_oppo')
    }
    return i18n.t('storage.only_standard_storage_granted')
  }
  return i18n.t('storage.all_files_access_settings_hint')
}

export function isExternalBaiShouRootPath(pathUri: string): boolean {
  const path = pathUri.replace(/^file:\/\//, '')
  return path.includes('/BaiShou_Root') && !path.includes('/files/Vaults')
}

/** Android：无全文件权限时抛出，阻止写入沙盒 */
export async function assertExternalStorageReady(): Promise<void> {
  if (Platform.OS !== 'android') return
  if (!(await hasStoragePermission())) {
    throw new ExternalStorageRequiredError()
  }
}

export {
  ExternalStorageRequiredError,
  isExternalStorageRequiredError
} from './storage-required.error'

async function openAllFilesAccessSettingsFallback(): Promise<boolean> {
  if (!Application.applicationId) return false

  const packageUri = `package:${Application.applicationId}`
  const attempts: Array<{ action: string; data?: string }> = [
    { action: 'android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION', data: packageUri },
    { action: 'android.settings.MANAGE_ALL_FILES_ACCESS_PERMISSION' },
    { action: 'android.settings.APPLICATION_DETAILS_SETTINGS', data: packageUri }
  ]

  for (const { action, data } of attempts) {
    try {
      await IntentLauncher.startActivityAsync(action, data ? { data } : undefined)
      return true
    } catch {
      // 部分 realme / ColorOS 机型首个 Intent 不可用，继续尝试下一个
    }
  }
  return false
}

export type StoragePermissionOemKey = 'xiaomi' | 'huawei' | 'oppo' | 'vivo' | 'samsung' | 'generic'

/** 当前设备 ROM 标识，用于展示厂商专属引导文案 */
export function getStoragePermissionOemKey(): StoragePermissionOemKey {
  if (Platform.OS !== 'android') return 'generic'
  const key = nativeGetStoragePermissionOemKey()
  if (
    key === 'xiaomi' ||
    key === 'huawei' ||
    key === 'oppo' ||
    key === 'vivo' ||
    key === 'samsung'
  ) {
    return key
  }
  return 'generic'
}

/** 用户确认后跳转设置页时展示的说明（按 ROM 区分） */
export function getStoragePermissionConfirmMessage(): string {
  const oem = getStoragePermissionOemKey()
  const oemMessage = i18n.t(`storage.permission_confirm_message_${oem}`, { defaultValue: '' })
  if (oemMessage) return oemMessage
  return i18n.t('storage.permission_confirm_message')
}

/** 仅打开系统/ROM 权限页，不弹应用内确认（由调用方决定是否先确认） */
export async function openStoragePermissionSettings(): Promise<boolean> {
  if (Platform.OS !== 'android') return true

  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0
  if (apiLevel >= 30) {
    if (isBaishouServerAvailable()) {
      const opened = nativeOpenAllFilesAccessSettings()
      if (opened) return true
    }
    return openAllFilesAccessSettingsFallback()
  }

  if (!Application.applicationId) return false
  try {
    await IntentLauncher.startActivityAsync('android.settings.APPLICATION_DETAILS_SETTINGS', {
      data: `package:${Application.applicationId}`
    })
    return true
  } catch {
    return false
  }
}

/**
 * 请求全文件访问：Android 11+ 跳转系统/ROM 设置；较低版本弹出 WRITE_EXTERNAL_STORAGE 系统对话框
 */
export async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true

  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0

  if (apiLevel >= 30) {
    const opened = await openStoragePermissionSettings()
    if (!opened) return false
    return hasStoragePermission()
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    {
      title: i18n.t('storage.permission_request_title'),
      message: i18n.t('storage.permission_request_message'),
      buttonPositive: i18n.t('storage.permission_request_positive'),
      buttonNegative: i18n.t('storage.permission_request_negative')
    }
  )
  return result === PermissionsAndroid.RESULTS.GRANTED
}

export async function openAllFilesAccessSettings(): Promise<void> {
  await openStoragePermissionSettings()
}
