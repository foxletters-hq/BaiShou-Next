type AudioStatus = {
  didJustFinish?: boolean
  playbackState?: string
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

let activePlayer: AudioPlayer | null = null
let activeListener: { remove: () => void } | null = null

async function loadExpoAudio() {
  return import('expo-audio')
}

export async function stopTtsAudioPlayback(): Promise<void> {
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
}

export async function playTtsAudio(
  audioBase64: string,
  format: string,
  onFinished?: () => void
): Promise<void> {
  await stopTtsAudioPlayback()

  const { createAudioPlayer, setAudioModeAsync } = await loadExpoAudio()
  await setAudioModeAsync({ playsInSilentMode: true })

  const player = createAudioPlayer({
    uri: `data:audio/${format || 'mp3'};base64,${audioBase64}`
  })

  return new Promise<void>((resolve, reject) => {
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      onFinished?.()
      resolve()
    }

    const fail = (error: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      activeListener?.remove()
      activeListener = null
      void stopTtsAudioPlayback()
      reject(error)
    }

    const timeout = setTimeout(() => {
      fail(new Error('TTS playback timed out'))
    }, PLAYBACK_TIMEOUT_MS)

    activeListener = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        finish()
        void stopTtsAudioPlayback()
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
