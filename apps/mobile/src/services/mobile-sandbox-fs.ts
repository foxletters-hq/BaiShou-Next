/**
 * 仅用于应用沙盒 / cache / content:// 等 Expo 可写路径。
 * 业务数据（BaiShou_Root）不得直接 import 本模块。
 */
import * as ExpoFS from 'expo-file-system/legacy'

export const documentDirectory = ExpoFS.documentDirectory
export const cacheDirectory = ExpoFS.cacheDirectory

export const EncodingType = ExpoFS.EncodingType

export const copyAsync = ExpoFS.copyAsync
export const readAsStringAsync = ExpoFS.readAsStringAsync
export const writeAsStringAsync = ExpoFS.writeAsStringAsync
export const getInfoAsync = ExpoFS.getInfoAsync
export const makeDirectoryAsync = ExpoFS.makeDirectoryAsync
export const deleteAsync = ExpoFS.deleteAsync
export const readDirectoryAsync = ExpoFS.readDirectoryAsync
export const moveAsync = ExpoFS.moveAsync
