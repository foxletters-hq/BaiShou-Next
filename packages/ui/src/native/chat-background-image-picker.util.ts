import * as ImagePicker from 'expo-image-picker'
import { CHAT_BACKGROUND_CROP_ASPECT } from '@baishou/shared'

/** 申请相册读取权限 */
export async function requestChatBackgroundLibraryPermission(): Promise<boolean> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  return perm.granted
}

/** 打开系统相册，默认 3:4 裁剪框，用户可自行调整裁剪区域 */
export async function launchChatBackgroundImageLibraryAsync(): Promise<ImagePicker.ImagePickerResult> {
  return ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [...CHAT_BACKGROUND_CROP_ASPECT],
    quality: 0.9
  })
}
