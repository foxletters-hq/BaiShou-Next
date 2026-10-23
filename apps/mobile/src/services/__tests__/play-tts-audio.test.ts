import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const audioMock = vi.hoisted(() => ({
  setAudioModeAsync: vi.fn(async () => {}),
  createAudioPlayer: vi.fn(),
  createAudioPlaylist: vi.fn()
}))

const fsMock = vi.hoisted(() => ({
  writeAsStringAsync: vi.fn(async () => {}),
  deleteAsync: vi.fn(async () => {})
}))

vi.mock('expo-audio', () => audioMock)

vi.mock('../mobile-sandbox-fs', () => ({
  cacheDirectory: '/cache/',
  EncodingType: { Base64: 'base64' },
  writeAsStringAsync: fsMock.writeAsStringAsync,
  deleteAsync: fsMock.deleteAsync
}))

import { playTtsAudioSequence, stopTtsAudioPlayback } from '../play-tts-audio'

type Listener = (status: Record<string, unknown>) => void

function createFakePlayer() {
  let listener: Listener | undefined
  const player = {
    playing: false,
    currentTime: 0,
    play: vi.fn(() => {
      player.playing = true
    }),
    pause: vi.fn(() => {
      player.playing = false
    }),
    release: vi.fn(),
    addListener: vi.fn((_event: string, callback: Listener) => {
      listener = callback
      return { remove: vi.fn() }
    })
  }

  return {
    player,
    emit(status: Record<string, unknown>) {
      listener?.(status)
    }
  }
}

function createFakePlaylist() {
  let listener: Listener | undefined
  const playlist = {
    playing: false,
    currentIndex: 0,
    currentTime: 0,
    play: vi.fn(() => {
      playlist.playing = true
    }),
    pause: vi.fn(() => {
      playlist.playing = false
    }),
    destroy: vi.fn(),
    addListener: vi.fn((_event: string, callback: Listener) => {
      listener = callback
      return { remove: vi.fn() }
    })
  }

  return {
    playlist,
    emit(status: Record<string, unknown>) {
      listener?.(status)
    }
  }
}

async function flushStartup(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
}

describe('playTtsAudioSequence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    audioMock.setAudioModeAsync.mockClear()
    audioMock.createAudioPlayer.mockReset()
    audioMock.createAudioPlaylist.mockReset()
    fsMock.writeAsStringAsync.mockClear()
    fsMock.deleteAsync.mockClear()
  })

  afterEach(async () => {
    await stopTtsAudioPlayback()
    vi.useRealTimers()
  })

  it('keeps playing a single segment longer than 60 seconds while progress continues', async () => {
    const fake = createFakePlayer()
    audioMock.createAudioPlayer.mockReturnValue(fake.player)

    const playback = playTtsAudioSequence([{ audioBase64: 'audio', format: 'mp3' }])
    await flushStartup()

    fake.player.playing = true
    fake.emit({ isLoaded: true, playing: true, duration: 180, currentTime: 0 })

    for (let position = 30; position <= 150; position += 30) {
      fake.player.currentTime = position
      fake.emit({ isLoaded: true, playing: true, duration: 180, currentTime: position })
      await vi.advanceTimersByTimeAsync(30_000)
    }

    fake.player.playing = false
    fake.player.currentTime = 180
    fake.emit({
      didJustFinish: true,
      playing: false,
      isLoaded: true,
      duration: 180,
      currentTime: 180
    })

    await expect(playback).resolves.toBeUndefined()
    expect(fake.player.release).toHaveBeenCalled()
  })

  it('still fails when playback makes no progress', async () => {
    const fake = createFakePlayer()
    audioMock.createAudioPlayer.mockReturnValue(fake.player)

    const playback = playTtsAudioSequence([{ audioBase64: 'audio', format: 'mp3' }])
    const rejection = expect(playback).rejects.toThrow('TTS playback timed out')
    await flushStartup()

    fake.player.playing = true
    fake.emit({ isLoaded: true, playing: true, duration: 180, currentTime: 0 })

    await vi.advanceTimersByTimeAsync(60_000)

    await rejection
    expect(fake.player.release).toHaveBeenCalled()
  })

  it('recovers when the native position advanced while status events were delayed', async () => {
    const fake = createFakePlayer()
    audioMock.createAudioPlayer.mockReturnValue(fake.player)

    const playback = playTtsAudioSequence([{ audioBase64: 'audio', format: 'mp3' }])
    await flushStartup()

    fake.player.playing = true
    fake.emit({ isLoaded: true, playing: true, duration: 180, currentTime: 0 })

    // JS 定时器延迟触发期间，原生播放器仍在前进。
    fake.player.currentTime = 30
    await vi.advanceTimersByTimeAsync(60_000)

    fake.player.playing = false
    fake.player.currentTime = 180
    fake.emit({
      didJustFinish: true,
      playing: false,
      isLoaded: true,
      duration: 180,
      currentTime: 180
    })

    await expect(playback).resolves.toBeUndefined()
  })

  it('does not cap a multi-segment playlist at 60 seconds per segment', async () => {
    const fake = createFakePlaylist()
    audioMock.createAudioPlaylist.mockReturnValue(fake.playlist)

    const playback = playTtsAudioSequence([
      { audioBase64: 'first', format: 'mp3' },
      { audioBase64: 'second', format: 'mp3' }
    ])
    await flushStartup()

    fake.playlist.playing = true
    fake.emit({
      isLoaded: true,
      playing: true,
      currentIndex: 0,
      currentTime: 0,
      duration: 120
    })

    for (let position = 20; position <= 120; position += 20) {
      fake.playlist.currentTime = position
      fake.emit({
        isLoaded: true,
        playing: true,
        currentIndex: 0,
        currentTime: position,
        duration: 120
      })
      await vi.advanceTimersByTimeAsync(20_000)
    }

    fake.playlist.currentIndex = 1
    fake.playlist.currentTime = 0
    fake.emit({
      isLoaded: true,
      playing: true,
      currentIndex: 1,
      currentTime: 0,
      duration: 120
    })

    for (let position = 20; position <= 120; position += 20) {
      fake.playlist.currentTime = position
      fake.emit({
        isLoaded: true,
        playing: true,
        currentIndex: 1,
        currentTime: position,
        duration: 120
      })
      await vi.advanceTimersByTimeAsync(20_000)
    }

    fake.playlist.playing = false
    fake.emit({
      didJustFinish: true,
      playing: false,
      isLoaded: true,
      currentIndex: 1,
      currentTime: 120,
      duration: 120
    })

    await expect(playback).resolves.toBeUndefined()
    expect(fake.playlist.destroy).toHaveBeenCalled()
  })
})
