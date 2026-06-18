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

type PlaylistStatus = {
  didJustFinish?: boolean
  currentIndex?: number
  trackCount?: number
  playing?: boolean
}

type AudioPlaylist = {
  play: () => void
  pause: () => void
  destroy: () => void
  addListener: (
    event: 'playlistStatusUpdate',
    listener: (status: PlaylistStatus) => void
  ) => { remove: () => void }
}

const PLAYBACK_TIMEOUT_MS = 60_000
const LOAD_TIMEOUT_MS = 15_000

let activePlayer: AudioPlayer | null = null
let activeListener: { remove: () => void } | null = null
let activePlaylist: AudioPlaylist | null = null
let activePlaylistListener: { remove: () => void } | null = null
let activeTempUri: string | null = null
let activeTempUris: string[] = []
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

async function cleanupTempFiles(uris: string[]): Promise<void> {
  await Promise.all(uris.map((uri) => deleteAsync(uri, { idempotent: true }).catch(() => {})))
}

async function cleanupTempFile(): Promise<void> {
  if (!activeTempUri) return
  const uri = activeTempUri
  activeTempUri = null
  await deleteAsync(uri, { idempotent: true }).catch(() => {})
}

function releaseActivePlaylist(): void {
  activePlaylistListener?.remove()
  activePlaylistListener = null
  if (activePlaylist) {
    try {
      activePlaylist.pause()
      activePlaylist.destroy()
    } catch {
      /* ignore */
    }
    activePlaylist = null
  }
  const uris = activeTempUris
  activeTempUris = []
  void cleanupTempFiles(uris)
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

function releaseActivePlayback(): void {
  releaseActivePlayer()
  releaseActivePlaylist()
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
  releaseActivePlayback()
}

async function playPreparedAudioFile(
  tempUri: string,
  generation: number
): Promise<void> {
  const { createAudioPlayer, setAudioModeAsync } = await loadExpoAudio()
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true
  })

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

  if (segments.length === 1) {
    try {
      await playTtsAudioSegment(segments[0]!.audioBase64, segments[0]!.format)
      onFinished?.()
    } catch (error) {
      onFinished?.()
      throw error
    }
    return
  }

  const { createAudioPlaylist, setAudioModeAsync } = await loadExpoAudio()
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true
  })

  const tempUris: string[] = []
  try {
    for (const segment of segments) {
      if (generation !== playbackGeneration) break
      tempUris.push(await writeAudioToTempFile(segment.audioBase64, segment.format))
    }

    if (generation !== playbackGeneration || !tempUris.length) {
      await cleanupTempFiles(tempUris)
      onFinished?.()
      return
    }

    activeTempUris = tempUris
    const playlist = createAudioPlaylist({
      sources: tempUris.map((uri) => ({ uri })),
      loop: 'none'
    })
    activePlaylist = playlist

    await new Promise<void>((resolve, reject) => {
      let settled = false

      const finish = () => {
        if (settled || generation !== playbackGeneration) return
        settled = true
        clearTimeout(timeout)
        releaseActivePlaylist()
        resolve()
      }

      const fail = (error: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        releaseActivePlaylist()
        reject(error)
      }

      const timeout = setTimeout(() => {
        fail(new Error('TTS playback timed out'))
      }, PLAYBACK_TIMEOUT_MS * segments.length)

      activePlaylistListener = playlist.addListener('playlistStatusUpdate', (status) => {
        if (generation !== playbackGeneration) return
        if (status.didJustFinish) {
          finish()
        }
      })

      try {
        playlist.play()
      } catch (error) {
        fail(error instanceof Error ? error : new Error('TTS playback failed'))
      }
    })

    onFinished?.()
  } catch (error) {
    await cleanupTempFiles(tempUris)
    activeTempUris = []
    onFinished?.()
    throw error
  }
}
