/**
 * HTTP 上传/下载（Expo 专用，不参与 vault 目录 mkdir）。
 */
import * as ExpoFS from 'expo-file-system/legacy'

export const FileSystemUploadType = ExpoFS.FileSystemUploadType

export const uploadAsync = ExpoFS.uploadAsync
export const downloadAsync = ExpoFS.downloadAsync
