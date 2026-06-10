import { Platform } from 'react-native'
import { logger } from '@baishou/shared'
import {
  isNativeDirectoryPickerAvailable,
  pickDirectoryAsync,
  type PickDirectoryResult
} from 'expo-baishou-server'
import { normalizeExternalStoragePath, stripFileScheme } from './android-external-fs'

export type DirectoryPickOutcome =
  | { status: 'canceled' }
  | { status: 'selected'; path: string }
  | { status: 'unavailable' }

const PICK_DIRECTORY_TIMEOUT_MS = 5 * 60 * 1000

function normalizePickedPath(path: string): string {
  return stripFileScheme(normalizeExternalStoragePath(path)).replace(/\/+$/, '')
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('PICK_DIRECTORY_TIMEOUT'))
    }, ms)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

export function canUseNativeDirectoryPicker(): boolean {
  return Platform.OS === 'android' && isNativeDirectoryPickerAvailable()
}

export async function pickUserDirectory(): Promise<DirectoryPickOutcome> {
  if (!canUseNativeDirectoryPicker()) {
    return { status: 'unavailable' }
  }

  try {
    const result: PickDirectoryResult = await withTimeout(
      pickDirectoryAsync(),
      PICK_DIRECTORY_TIMEOUT_MS
    )
    if (result.canceled) {
      return { status: 'canceled' }
    }
    return { status: 'selected', path: normalizePickedPath(result.path) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'PICK_DIRECTORY_TIMEOUT') {
      logger.warn('[pick-directory] native picker timed out')
    } else {
      logger.warn('[pick-directory] native picker failed:', message)
    }
    return { status: 'unavailable' }
  }
}
