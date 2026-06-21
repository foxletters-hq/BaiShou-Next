import { InteractionManager, Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'

/** 申请相册读取权限 */
export async function requestAvatarLibraryPermission(): Promise<boolean> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  return perm.granted
}

/**
 * 等 Dialog / Modal 完全关闭后再执行（Android 上否则相册 Activity 常被吞掉）。
 */
export function runAfterOverlayDismiss(action: () => void): void {
  InteractionManager.runAfterInteractions(() => {
    const delayMs = Platform.OS === 'android' ? 320 : 64
    setTimeout(action, delayMs)
  })
}

/** 打开系统相册并进入 1:1 裁剪（用户感知的「选择框」） */
export async function launchAvatarImageLibraryAsync(): Promise<ImagePicker.ImagePickerResult> {
  return ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
    copyToCacheDirectory: true
  })
}
