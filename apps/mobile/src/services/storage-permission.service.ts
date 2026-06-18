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
  probeExternalStorageWritable
} from 'expo-baishou-server'

/** 与桌面端 / 旧版 BaiShou 一致的外部数据根目录 */
export const EXTERNAL_STORAGE_ROOT = '/storage/emulated/0/BaiShou_Root'

/** 展示 / 深链用 file URI */
export const EXTERNAL_STORAGE_ROOT_URI = `file://${EXTERNAL_STORAGE_ROOT}`

/**
 * 检查是否具备「管理所有文件」权限（Android 11+）。
 * 可写性探测在挂载阶段单独进行，避免部分 ROM（如 ColorOS）误报未授权。
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
  if (!(await hasStoragePermission())) return false
  return probeExternalStorageWritable()
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

async function openAllFilesAccessSettingsFallback(): Promise<void> {
  if (!Application.applicationId) return
  await IntentLauncher.startActivityAsync(
    'android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION',
    { data: `package:${Application.applicationId}` }
  )
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
export async function openStoragePermissionSettings(): Promise<void> {
  if (Platform.OS !== 'android') return

  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0
  if (apiLevel >= 30) {
    if (isBaishouServerAvailable()) {
      const opened = nativeOpenAllFilesAccessSettings()
      if (!opened) {
        await openAllFilesAccessSettingsFallback()
      }
    } else {
      await openAllFilesAccessSettingsFallback()
    }
    return
  }

  if (!Application.applicationId) return
  await IntentLauncher.startActivityAsync('android.settings.APPLICATION_DETAILS_SETTINGS', {
    data: `package:${Application.applicationId}`
  })
}

/**
 * 请求全文件访问：Android 11+ 跳转系统/ROM 设置；较低版本弹出 WRITE_EXTERNAL_STORAGE 系统对话框
 */
export async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true

  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0

  if (apiLevel >= 30) {
    await openStoragePermissionSettings()
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
