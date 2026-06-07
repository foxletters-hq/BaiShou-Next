type AudioPlayer = {
  play: () => void
  pause: () => void
  release: () => void
  addListener: (
    event: 'playbackStatusUpdate',
    listener: (status: { didJustFinish?: boolean }) => void
  ) => { remove: () => void }
}

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

  activeListener = player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) {
      onFinished?.()
      void stopTtsAudioPlayback()
    }
  })
  activePlayer = player
  player.play()
}
