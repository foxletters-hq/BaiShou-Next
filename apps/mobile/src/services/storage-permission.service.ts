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
  probeExternalStorageWritable
} from 'expo-baishou-server'

/** 与桌面端 / 旧版 BaiShou 一致的外部数据根目录 */
export const EXTERNAL_STORAGE_ROOT = 'file:///storage/emulated/0/BaiShou_Root'

/**
 * 检查是否具备外部存储读写能力（对齐 BaiShou PermissionService.hasStoragePermission）
 * 仅信任原生 java.io.File 探测，不使用 expo-file-system（Scoped Storage 会误报/误拒）
 */
export async function hasStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true

  if (!isBaishouServerAvailable() || !isExternalStorageNativeAvailable()) {
    return false
  }

  return nativeHasAllFilesAccess() && probeExternalStorageWritable()
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

/**
 * 请求全文件访问：Android 11+ 跳转系统设置；较低版本请求 WRITE_EXTERNAL_STORAGE
 */
export async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true

  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0

  if (apiLevel >= 30) {
    if (isBaishouServerAvailable()) {
      nativeOpenAllFilesAccessSettings()
    } else {
      await openAllFilesAccessSettingsFallback()
    }
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
  if (Platform.OS !== 'android') return
  if (isBaishouServerAvailable()) {
    nativeOpenAllFilesAccessSettings()
    return
  }
  await openAllFilesAccessSettingsFallback()
}
