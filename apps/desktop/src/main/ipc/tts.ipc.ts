import { ipcMain, dialog, BrowserWindow, type OpenDialogOptions, type WebContents } from 'electron'
import {
  logger,
  synthesizeTtsFromFormConfig,
  synthesizeTtsFromSettings,
  synthesizeTtsSpeechContent,
  getDefaultTtsRegistry,
  type GlobalModelsConfig,
  type TtsFormSynthesizeConfig,
  type TtsSpeechSegment
} from '@baishou/shared'
import { settingsManager } from './settings.ipc'

const registry = getDefaultTtsRegistry()

interface SpeechSession {
  cancelled: boolean
  sender: WebContents
}

const speechSessions = new Map<string, SpeechSession>()
const segmentAckResolvers = new Map<string, () => void>()

function segmentAckKey(sessionId: string, index: number): string {
  return `${sessionId}:${index}`
}

function logSynthesisFailure(
  result: { errorCode?: string; error?: string },
  providerId?: string,
  globalModels?: GlobalModelsConfig | null
): void {
  if (result.errorCode === 'tts_provider_not_supported') {
    logger.error(
      `[TTS] No provider found for ID: ${providerId || globalModels?.globalTtsProviderId}`
    )
  } else if (
    result.errorCode === 'tts_synthesis_failed' ||
    result.errorCode === 'tts_api_error'
  ) {
    logger.error('[TTS] Synthesize error:', result.error)
  }
}

function waitForSegmentPlaybackAck(sessionId: string, index: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const key = segmentAckKey(sessionId, index)
    const timeout = setTimeout(() => {
      segmentAckResolvers.delete(key)
      reject(new Error('TTS segment playback ack timed out'))
    }, 120_000)

    segmentAckResolvers.set(key, () => {
      clearTimeout(timeout)
      segmentAckResolvers.delete(key)
      resolve()
    })
  })
}

export function registerTtsIPC() {
  ipcMain.on('agent:tts-speech-segment-ack', (_event, sessionId: string, index: number) => {
    segmentAckResolvers.get(segmentAckKey(sessionId, index))?.()
  })

  ipcMain.handle('agent:tts-cancel-speech', (_event, sessionId: string) => {
    const session = speechSessions.get(sessionId)
    if (session) {
      session.cancelled = true
    }
    for (const key of segmentAckResolvers.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        segmentAckResolvers.get(key)?.()
        segmentAckResolvers.delete(key)
      }
    }
  })

  ipcMain.handle(
    'agent:tts-synthesize',
    async (_event, text: string, providerId?: string, modelId?: string) => {
      const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')

      const result = await synthesizeTtsFromSettings(registry, {
        globalModels,
        text,
        providerId,
        modelId
      })

      if (!result.success) {
        logSynthesisFailure(result, providerId, globalModels)
      }

      return result
    }
  )

  ipcMain.handle(
    'settings:tts-test',
    async (_event, config: TtsFormSynthesizeConfig, text: string) => {
      const result = await synthesizeTtsFromFormConfig(registry, config, text)

      if (!result.success) {
        if (result.errorCode === 'tts_provider_not_supported') {
          logger.error(`[TTS] No provider found for form config provider: ${config?.id}`)
        } else if (
          result.errorCode === 'tts_synthesis_failed' ||
          result.errorCode === 'tts_api_error'
        ) {
          logger.error('[TTS] Form synthesize error:', result.error)
        }
      }

      return result
    }
  )

  ipcMain.handle('settings:pick-tts-ref-audio', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      title: '选择参考音频',
      properties: ['openFile'],
      filters: [
        { name: 'Audio', extensions: ['wav', 'mp3', 'mpeg'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0] ?? null
  })

  ipcMain.handle(
    'agent:tts-synthesize-speech',
    async (event, sessionId: string, content: string, providerId?: string, modelId?: string) => {
      const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')

      speechSessions.set(sessionId, {
        cancelled: false,
        sender: event.sender
      })

      try {
        const result = await synthesizeTtsSpeechContent(
          registry,
          {
            globalModels,
            content,
            providerId,
            modelId
          },
          {
            isCancelled: () => speechSessions.get(sessionId)?.cancelled ?? true,
            onSegmentReady: async (segment: TtsSpeechSegment, index: number) => {
              const session = speechSessions.get(sessionId)
              if (!session || session.cancelled) return

              const ackPromise = waitForSegmentPlaybackAck(sessionId, index)
              session.sender.send('agent:tts-speech-segment', {
                sessionId,
                index,
                segment
              })
              await ackPromise
            }
          }
        )

        if (!result.success) {
          logSynthesisFailure(result, providerId, globalModels)
        }

        return result
      } finally {
        speechSessions.delete(sessionId)
        for (const key of segmentAckResolvers.keys()) {
          if (key.startsWith(`${sessionId}:`)) {
            segmentAckResolvers.delete(key)
          }
        }
      }
    }
  )
}
