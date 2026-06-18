import {
  cacheDirectory,
  deleteAsync,
  EncodingType,
  writeAsStringAsync
} from './mobile-sandbox-fs'

type AudioStatus = {
  didJustFinish?: boolean
  playbackState?: string
  isLoaded?: boolean
  playing?: boolean
  duration?: number
  currentTime?: number
}

type AudioPlayer = {
  play: () => void
  pause: () => void
  release: () => void
  addListener: (
    event: 'playbackStatusUpdate',
    listener: (status: AudioStatus) => void
  ) => { remove: () => void }
}

const PLAYBACK_TIMEOUT_MS = 60_000
const LOAD_TIMEOUT_MS = 15_000

let activePlayer: AudioPlayer | null = null
let activeListener: { remove: () => void } | null = null
let activeTempUri: string | null = null
let playbackGeneration = 0

async function loadExpoAudio() {
  return import('expo-audio')
}

function normalizeAudioFormat(format: string): string {
  const normalized = (format || 'mp3').toLowerCase().trim()
  if (normalized === 'mpeg') return 'mp3'
  return normalized.replace(/^x-/, '')
}

async function writeAudioToTempFile(audioBase64: string, format: string): Promise<string> {
  if (!cacheDirectory) {
    throw new Error('TTS playback cache unavailable')
  }

  const ext = normalizeAudioFormat(format)
  const uri = `${cacheDirectory}tts_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  await writeAsStringAsync(uri, audioBase64, { encoding: EncodingType.Base64 })
  return uri
}

async function cleanupTempFile(): Promise<void> {
  if (!activeTempUri) return
  const uri = activeTempUri
  activeTempUri = null
  await deleteAsync(uri, { idempotent: true }).catch(() => {})
}

function releaseActivePlayer(): void {
  activeListener?.remove()
  activeListener = null
  if (activePlayer) {
    try {
      activePlayer.pause()
      activePlayer.release()
    } catch {
      /* ignore */
    }
    activePlayer = null
  }
  void cleanupTempFile()
}

function hasPlaybackFinished(status: AudioStatus): boolean {
  if (status.didJustFinish) return true

  const state = String(status.playbackState ?? '').toLowerCase()
  if (state === 'ended') return true

  const duration = status.duration ?? 0
  const currentTime = status.currentTime ?? 0
  return (
    duration > 0 &&
    currentTime >= duration - 0.25 &&
    status.playing === false &&
    status.isLoaded === true
  )
}

export async function stopTtsAudioPlayback(): Promise<void> {
  playbackGeneration += 1
  releaseActivePlayer()
}

async function playPreparedAudioFile(
  tempUri: string,
  generation: number
): Promise<void> {
  const { createAudioPlayer, setAudioModeAsync } = await loadExpoAudio()
  await setAudioModeAsync({ playsInSilentMode: true })

  const player = createAudioPlayer({ uri: tempUri })

  return new Promise<void>((resolve, reject) => {
    let settled = false
    let hasStartedPlayback = false

    const finish = () => {
      if (settled || generation !== playbackGeneration) return
      settled = true
      clearTimeout(timeout)
      clearTimeout(loadTimeout)
      releaseActivePlayer()
      resolve()
    }

    const fail = (error: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      clearTimeout(loadTimeout)
      releaseActivePlayer()
      reject(error)
    }

    const timeout = setTimeout(() => {
      fail(new Error('TTS playback timed out'))
    }, PLAYBACK_TIMEOUT_MS)

    const loadTimeout = setTimeout(() => {
      if (!hasStartedPlayback) {
        fail(new Error('TTS playback failed to start'))
      }
    }, LOAD_TIMEOUT_MS)

    activeListener = player.addListener('playbackStatusUpdate', (status) => {
      if (generation !== playbackGeneration) return

      if (status.isLoaded || status.playing) {
        hasStartedPlayback = true
        clearTimeout(loadTimeout)
      }

      if (hasPlaybackFinished(status)) {
        finish()
        return
      }

      const state = String(status.playbackState ?? '').toLowerCase()
      if (state.includes('fail') || state.includes('error')) {
        fail(new Error('TTS playback failed'))
      }
    })
    activePlayer = player

    try {
      player.play()
    } catch (error) {
      fail(error instanceof Error ? error : new Error('TTS playback failed'))
    }
  })
}

/** 播放单个分片；多段朗读时由外部控制顺序，不在开头 stop。 */
export async function playTtsAudioSegment(audioBase64: string, format: string): Promise<void> {
  const generation = playbackGeneration

  let tempUri: string
  try {
    tempUri = await writeAudioToTempFile(audioBase64, format)
    activeTempUri = tempUri
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to prepare audio file'
    throw new Error(`TTS playback failed: ${message}`)
  }

  await playPreparedAudioFile(tempUri, generation)
}

export async function playTtsAudio(
  audioBase64: string,
  format: string,
  onFinished?: () => void
): Promise<void> {
  await stopTtsAudioPlayback()
  try {
    await playTtsAudioSegment(audioBase64, format)
    onFinished?.()
  } catch (error) {
    onFinished?.()
    throw error
  }
}

export async function playTtsAudioSequence(
  segments: Array<{ audioBase64: string; format: string }>,
  onFinished?: () => void
): Promise<void> {
  await stopTtsAudioPlayback()
  const generation = playbackGeneration

  if (!segments.length) {
    onFinished?.()
    return
  }

  try {
    for (const segment of segments) {
      if (generation !== playbackGeneration) break
      await playTtsAudioSegment(segment.audioBase64, segment.format)
    }
    onFinished?.()
  } catch (error) {
    onFinished?.()
    throw error
  }
}
