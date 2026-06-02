/**
 * HTTP 上传/下载（Expo 专用，不参与 vault 目录 mkdir）。
 * uploadAsync / downloadAsync 尚无新版 File API 等价物，继续走 legacy 子路径。
 */
import * as ExpoFS from 'expo-file-system/legacy'

export const FileSystemUploadType = ExpoFS.FileSystemUploadType

export const uploadAsync = ExpoFS.uploadAsync
export const downloadAsync = ExpoFS.downloadAsync
