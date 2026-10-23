import { cacheDirectory, deleteAsync, EncodingType, writeAsStringAsync } from './mobile-sandbox-fs'

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
  currentTime?: number
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
  isLoaded?: boolean
  currentTime?: number
  duration?: number
}

type AudioPlaylist = {
  play: () => void
  pause: () => void
  destroy: () => void
  currentTime?: number
  addListener: (
    event: 'playlistStatusUpdate',
    listener: (status: PlaylistStatus) => void
  ) => { remove: () => void }
}

/** 连续无播放进度超过该时长才判定卡死；长文本不设播放总时长上限。 */
const PLAYBACK_STALL_TIMEOUT_MS = 60_000
const LOAD_TIMEOUT_MS = 15_000
const PLAYBACK_PROGRESS_EPSILON_SECONDS = 0.05

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

type PlaybackProgress = {
  positionSeconds: number
  trackIndex?: number
}

/**
 * 播放进度看门狗：只在连续无进度时判定卡死，不限制总播放时长。
 * 定时器触发时会读取原生播放器的实时位置，避免后台 JS 定时器延迟造成误杀。
 */
function createPlaybackStallGuard(onStall: () => void, readLiveProgress: () => PlaybackProgress) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let lastPositionSeconds = -1
  let lastTrackIndex = -1

  const clearTimer = () => {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
  }

  const hasProgressed = (progress: PlaybackProgress): boolean => {
    const positionSeconds = Number.isFinite(progress.positionSeconds) ? progress.positionSeconds : 0
    const trackIndex = progress.trackIndex ?? 0

    if (trackIndex !== lastTrackIndex) {
      lastTrackIndex = trackIndex
      lastPositionSeconds = positionSeconds
      return true
    }

    if (positionSeconds > lastPositionSeconds + PLAYBACK_PROGRESS_EPSILON_SECONDS) {
      lastPositionSeconds = positionSeconds
      return true
    }
    return false
  }

  const arm = () => {
    clearTimer()
    if (!running) return
    timer = setTimeout(() => {
      timer = undefined
      if (!running) return

      let live: PlaybackProgress
      try {
        live = readLiveProgress()
      } catch {
        onStall()
        return
      }

      if (hasProgressed(live)) {
        arm()
        return
      }
      onStall()
    }, PLAYBACK_STALL_TIMEOUT_MS)
  }

  return {
    start() {
      running = true
      lastPositionSeconds = -1
      lastTrackIndex = -1
      arm()
    },
    stop() {
      running = false
      clearTimer()
    },
    update(progress: PlaybackProgress) {
      if (!running) return
      if (hasProgressed(progress) || timer === undefined) {
        arm()
      }
    }
  }
}

export async function stopTtsAudioPlayback(): Promise<void> {
  playbackGeneration += 1
  releaseActivePlayback()
}

async function playPreparedAudioFile(tempUri: string, generation: number): Promise<void> {
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
      stallGuard.stop()
      clearTimeout(loadTimeout)
      releaseActivePlayer()
      resolve()
    }

    const fail = (error: Error) => {
      if (settled) return
      settled = true
      stallGuard.stop()
      clearTimeout(loadTimeout)
      releaseActivePlayer()
      reject(error)
    }

    const stallGuard = createPlaybackStallGuard(
      () => fail(new Error('TTS playback timed out')),
      () => ({ positionSeconds: player.currentTime ?? 0 })
    )

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
        return
      }

      stallGuard.update({ positionSeconds: status.currentTime ?? 0 })
    })
    activePlayer = player
    stallGuard.start()

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
      let hasStartedPlayback = false

      const finish = () => {
        if (settled || generation !== playbackGeneration) return
        settled = true
        stallGuard.stop()
        clearTimeout(loadTimeout)
        releaseActivePlaylist()
        resolve()
      }

      const fail = (error: Error) => {
        if (settled) return
        settled = true
        stallGuard.stop()
        clearTimeout(loadTimeout)
        releaseActivePlaylist()
        reject(error)
      }

      const stallGuard = createPlaybackStallGuard(
        () => fail(new Error('TTS playback timed out')),
        () => ({
          positionSeconds: playlist.currentTime ?? 0,
          trackIndex: playlist.currentIndex
        })
      )

      const loadTimeout = setTimeout(() => {
        if (!hasStartedPlayback) {
          fail(new Error('TTS playback failed to start'))
        }
      }, LOAD_TIMEOUT_MS)

      activePlaylistListener = playlist.addListener('playlistStatusUpdate', (status) => {
        if (generation !== playbackGeneration) return

        if (status.isLoaded || status.playing) {
          hasStartedPlayback = true
          clearTimeout(loadTimeout)
        }

        if (status.didJustFinish) {
          finish()
          return
        }

        stallGuard.update({
          positionSeconds: status.currentTime ?? 0,
          trackIndex: status.currentIndex ?? 0
        })
      })

      stallGuard.start()
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
