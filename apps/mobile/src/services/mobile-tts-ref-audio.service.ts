import * as DocumentPicker from 'expo-document-picker'
import { Platform } from 'react-native'
import type { IFileSystem } from '@baishou/core-mobile'
import {
  assertMimoVoiceCloneAudioPath,
  isMimoVoiceCloneAudioExtension,
  normalizeRefAudioPath,
  registerTtsRefAudioReader
} from '@baishou/shared'
import { joinStoragePath } from './mobile-storage-path.util'
import { importUriToPath } from './mobile-uri-import'
import { assertExternalStorageReady } from './storage-permission.service'

const TTS_REF_AUDIO_DIR = 'tts-ref-audio'
const MAX_REF_AUDIO_BYTES = 10 * 1024 * 1024

export interface TtsRefAudioStorageService {
  getRootDirectory(): Promise<string>
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function sanitizeRefAudioFileName(name: string): string {
  const trimmed = name.trim() || 'ref-audio.mp3'
  return trimmed.replace(/[^\w.\-()\u4e00-\u9fff]/g, '_')
}

function ensureRefAudioExtension(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (isMimoVoiceCloneAudioExtension(lower)) {
    return sanitizeRefAudioFileName(fileName)
  }
  const base = sanitizeRefAudioFileName(fileName.replace(/\.[^.]+$/, '') || 'ref-audio')
  return `${base}.mp3`
}

function buildRefAudioDestPath(rootDir: string, sourceName: string): string {
  const safeName = ensureRefAudioExtension(sourceName)
  return joinStoragePath(rootDir, TTS_REF_AUDIO_DIR, `${Date.now()}_${safeName}`)
}

/** 向 shared TTS 注册移动端读盘：从 BaiShou_Root 等外部路径读取参考音频 */
export function setupMobileTtsRefAudioReader(fileSystem: IFileSystem): void {
  registerTtsRefAudioReader(async (path) => {
    const normalizedPath = normalizeRefAudioPath(path)
    assertMimoVoiceCloneAudioPath(normalizedPath)
    const base64 = await fileSystem.readFile(normalizedPath, 'base64')
    const bytes = base64ToUint8Array(base64)
    if (bytes.length > MAX_REF_AUDIO_BYTES) {
      throw new Error('参考音频文件不能超过 10MB')
    }
    return bytes
  })
}

/**
 * 选择参考音频并写入外部存储（BaiShou_Root/tts-ref-audio），返回绝对路径。
 */
export async function pickAndStoreTtsRefAudio(
  fileSystem: IFileSystem,
  pathService: TtsRefAudioStorageService
): Promise<string | null> {
  if (Platform.OS === 'android') {
    await assertExternalStorageReady()
  }

  const pick = await DocumentPicker.getDocumentAsync({
    type: ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-wav'],
    copyToCacheDirectory: false
  })
  if (pick.canceled || !pick.assets?.[0]?.uri) {
    return null
  }

  const asset = pick.assets[0]
  const sourceName = asset.name || asset.uri.split('/').pop() || 'ref-audio.mp3'
  if (!isMimoVoiceCloneAudioExtension(sourceName)) {
    throw new Error('MiMo 音色复刻仅支持 wav/mp3 参考音频')
  }
  if (asset.size != null && asset.size > MAX_REF_AUDIO_BYTES) {
    throw new Error('参考音频文件不能超过 10MB')
  }

  const rootDir = await pathService.getRootDirectory()
  const destPath = buildRefAudioDestPath(rootDir, sourceName)
  const destDir = joinStoragePath(rootDir, TTS_REF_AUDIO_DIR)
  await fileSystem.mkdir(destDir, { recursive: true })
  await importUriToPath(asset.uri, destPath, fileSystem)

  const stat = await fileSystem.stat(destPath)
  if (!stat.isFile) {
    throw new Error('参考音频保存失败')
  }
  if (stat.size != null && stat.size > MAX_REF_AUDIO_BYTES) {
    await fileSystem.unlink(destPath).catch(() => undefined)
    throw new Error('参考音频文件不能超过 10MB')
  }

  return normalizeRefAudioPath(destPath)
}
