import * as DocumentPicker from 'expo-document-picker'
import { Platform } from 'react-native'
import type { IFileSystem } from '@baishou/core-mobile'
import {
  assertMimoVoiceCloneAudioPath,
  isMimoVoiceCloneAudioExtension,
  normalizeRefAudioPath,
  registerTtsRefAudioBase64Reader,
  registerTtsRefAudioReader,
  assertSupportedRefAudioBase64,
  type TtsRefAudioPickResult
} from '@baishou/shared'
import { joinStoragePath } from './mobile-storage-path.util'
import { importUriToPath } from './mobile-uri-import'
import { assertExternalStorageReady } from './storage-permission.service'

const TTS_REF_AUDIO_DIR = 'tts-ref-audio'
const MAX_REF_AUDIO_BYTES = 10 * 1024 * 1024

export interface TtsRefAudioStorageService {
  getRootDirectory(): Promise<string>
}

const refAudioBase64ByPath = new Map<string, string>()

function stableHash(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
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

function cacheRefAudioBase64(path: string, base64: string): void {
  refAudioBase64ByPath.set(normalizeRefAudioPath(path), base64)
}

async function readRefAudioBase64FromDisk(fileSystem: IFileSystem, path: string): Promise<string> {
  const normalizedPath = normalizeRefAudioPath(path)
  assertMimoVoiceCloneAudioPath(normalizedPath)
  const cached = refAudioBase64ByPath.get(normalizedPath)
  if (cached) {
    assertSupportedRefAudioBase64(cached, normalizedPath)
    console.info('[MiMo TTS] ref_audio_cache_hit', {
      path: normalizedPath,
      base64Length: cached.length,
      base64Hash: stableHash(cached)
    })
    return cached
  }

  const base64 = (await fileSystem.readFile(normalizedPath, 'base64')).trim()
  if (!base64) {
    throw new Error('参考音频文件为空或读取失败')
  }
  assertSupportedRefAudioBase64(base64, normalizedPath)
  const approxBytes = Math.floor((base64.length * 3) / 4)
  if (approxBytes > MAX_REF_AUDIO_BYTES) {
    throw new Error('参考音频文件不能超过 10MB')
  }
  cacheRefAudioBase64(normalizedPath, base64)
  console.info('[MiMo TTS] ref_audio_read', {
    path: normalizedPath,
    approxBytes,
    base64Length: base64.length,
    base64Hash: stableHash(base64)
  })
  return base64
}

/** 向 shared TTS 注册移动端读盘：优先 base64 直读，避免字节往返损坏 */
export function setupMobileTtsRefAudioReader(fileSystem: IFileSystem): void {
  registerTtsRefAudioBase64Reader(async (path) => {
    return readRefAudioBase64FromDisk(fileSystem, path)
  })

  registerTtsRefAudioReader(async (path) => {
    const base64 = await readRefAudioBase64FromDisk(fileSystem, path)
    return base64ToUint8Array(base64)
  })
}

/**
 * 选择参考音频并写入外部存储（BaiShou_Root/tts-ref-audio），返回路径与 base64。
 */
export async function pickAndStoreTtsRefAudio(
  fileSystem: IFileSystem,
  pathService: TtsRefAudioStorageService
): Promise<TtsRefAudioPickResult | null> {
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
    throw new Error('参考音频仅支持 wav/mp3 格式')
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

  const normalizedPath = normalizeRefAudioPath(destPath)
  const base64 = await readRefAudioBase64FromDisk(fileSystem, normalizedPath)
  console.info('[MiMo TTS] ref_audio_picked', {
    sourceName,
    destPath: normalizedPath,
    assetSize: asset.size ?? null,
    storedSize: stat.size ?? null,
    base64Length: base64.length,
    base64Hash: stableHash(base64)
  })
  return { path: normalizedPath, base64 }
}
