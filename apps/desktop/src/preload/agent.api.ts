import { ipcRenderer } from 'electron'

export type TtsSpeechSegmentPayload = {
  text: string
  audioBase64: string
  format: string
  fromCache: boolean
}

export type TtsSynthesizeSpeechResult =
  | { success: true; segmentCount: number }
  | { success: false; errorCode: string; error?: string; statusCode?: number }

export const agentApi = {
  agentChat: (params: { sessionId: string; text: string }) =>
    ipcRenderer.invoke('agent:chat', params),
  saveUserMessage: (params: { sessionId: string; text: string; attachments?: any[] }) =>
    ipcRenderer.invoke('agent:save-user-message', params),
  getMessages: (sessionId: string) => ipcRenderer.invoke('agent:get-messages', sessionId),
  getContextAtMessage: (sessionId: string, messageId: string, searchMode?: boolean) =>
    ipcRenderer.invoke('agent:get-context-at-message', sessionId, messageId, searchMode),

  onAgentStreamChunk: (callback: (chunk: string) => void) => {
    ipcRenderer.on('agent:stream-chunk', (_event, chunk) => callback(chunk))
  },
  onAgentStreamFinish: (callback: (error?: string) => void) => {
    ipcRenderer.on('agent:stream-finish', (_event, error) => callback(error))
  },
  removeAgentListeners: () => {
    ipcRenderer.removeAllListeners('agent:stream-chunk')
    ipcRenderer.removeAllListeners('agent:stream-finish')
  },

  getProviders: () => ipcRenderer.invoke('agent:get-providers'),

  // TTS
  tts: {
    synthesize: (text: string, providerId?: string, modelId?: string) =>
      ipcRenderer.invoke('agent:tts-synthesize', text, providerId, modelId),
    synthesizeSpeech: (
      content: string,
      options?: {
        sessionId?: string
        providerId?: string
        modelId?: string
        onSegment?: (segment: TtsSpeechSegmentPayload, index: number) => void | Promise<void>
      }
    ): Promise<TtsSynthesizeSpeechResult> => {
      const sessionId =
        options?.sessionId ??
        globalThis.crypto?.randomUUID?.() ??
        `tts-${Date.now()}-${Math.random()}`

      return new Promise<TtsSynthesizeSpeechResult>((resolve, reject) => {
        const onSegmentEvent = async (
          _event: unknown,
          payload: {
            sessionId: string
            index: number
            segment: TtsSpeechSegmentPayload
          }
        ) => {
          if (payload.sessionId !== sessionId) return

          try {
            await options?.onSegment?.(payload.segment, payload.index)
            ipcRenderer.send('agent:tts-speech-segment-ack', sessionId, payload.index)
          } catch (error) {
            void ipcRenderer.invoke('agent:tts-cancel-speech', sessionId)
            reject(error)
          }
        }

        ipcRenderer.on('agent:tts-speech-segment', onSegmentEvent)

        ipcRenderer
          .invoke(
            'agent:tts-synthesize-speech',
            sessionId,
            content,
            options?.providerId,
            options?.modelId
          )
          .then((result) => resolve(result as TtsSynthesizeSpeechResult))
          .catch(reject)
          .finally(() => {
            ipcRenderer.removeListener('agent:tts-speech-segment', onSegmentEvent)
          })
      })
    },
    cancelSpeech: (sessionId: string) => ipcRenderer.invoke('agent:tts-cancel-speech', sessionId)
  },

  // Sessions
  getSessions: () => ipcRenderer.invoke('agent:get-sessions'),
  deleteSessions: (ids: string[]) => ipcRenderer.invoke('agent:delete-sessions', ids),
  pinSession: (id: string, isPinned: boolean) =>
    ipcRenderer.invoke('agent:pin-session', id, isPinned),

  // Assistants
  getAssistants: () => ipcRenderer.invoke('agent:get-assistants'),
  createAssistant: (input: any) => ipcRenderer.invoke('agent:create-assistant', input),
  updateAssistant: (id: string, input: any) =>
    ipcRenderer.invoke('agent:update-assistant', id, input),
  deleteAssistant: (id: string) => ipcRenderer.invoke('agent:delete-assistant', id),
  reorderAssistants: (orderedIds: string[]) =>
    ipcRenderer.invoke('agent:reorder-assistants', orderedIds),
  syncDefaultLatteLocale: (locale?: string) =>
    ipcRenderer.invoke('agent:sync-default-latte-locale', locale),
  ensureDefaultLatteAssistant: (locale?: string) =>
    ipcRenderer.invoke('agent:ensure-default-latte-assistant', locale),

  agentGate: {
    reply: (input: {
      requestId: string
      reply: import('@baishou/shared').AgentGateReply
      message?: string
      selectedOptionIds?: string[]
    }) => ipcRenderer.invoke('agent-gate:reply', input),
    listPending: (sessionId?: string) =>
      ipcRenderer.invoke('agent-gate:list-pending', sessionId) as Promise<
        import('@baishou/shared').AgentGateRequest[]
      >,
    getNotificationPrefs: () =>
      ipcRenderer.invoke('agent-gate:get-notification-prefs') as Promise<
        import('@baishou/shared').AgentGateNotificationPrefs
      >,
    setNotificationPrefs: (prefs: Partial<import('@baishou/shared').AgentGateNotificationPrefs>) =>
      ipcRenderer.invoke('agent-gate:set-notification-prefs', prefs) as Promise<
        import('@baishou/shared').AgentGateNotificationPrefs
      >,
    notifyAsked: (request: import('@baishou/shared').AgentGateRequest) =>
      ipcRenderer.invoke('agent-gate:notify-asked', request),
    getConfig: (scope?: import('@baishou/shared').AgentGateConfigScope) =>
      ipcRenderer.invoke('agent-gate:get-config', scope),
    setTrustMode: (
      trustMode: import('@baishou/shared').AgentGateTrustMode,
      scope?: import('@baishou/shared').AgentGateConfigScope
    ) => ipcRenderer.invoke('agent-gate:set-trust-mode', trustMode, scope),
    removeAllowlistEntry: (
      entryId: string,
      scope?: import('@baishou/shared').AgentGateConfigScope
    ) => ipcRenderer.invoke('agent-gate:remove-allowlist-entry', entryId, scope),
    onAsked: (callback: (request: import('@baishou/shared').AgentGateRequest) => void) => {
      const handler = (_: unknown, request: import('@baishou/shared').AgentGateRequest) =>
        callback(request)
      ipcRenderer.on('agent-gate:asked', handler)
      return () => ipcRenderer.removeListener('agent-gate:asked', handler)
    },
    onReplied: (
      callback: (payload: {
        sessionId: string
        requestId: string
        reply: import('@baishou/shared').AgentGateReply
      }) => void
    ) => {
      const handler = (_: unknown, payload: Parameters<typeof callback>[0]) => callback(payload)
      ipcRenderer.on('agent-gate:replied', handler)
      return () => ipcRenderer.removeListener('agent-gate:replied', handler)
    },
    onAllowlistChanged: (
      callback: (
        allowlist: import('@baishou/shared').AgentGateAllowlistEntry[],
        scope?: import('@baishou/shared').AgentGateConfigScope
      ) => void
    ) => {
      const handler = (
        _: unknown,
        payload:
          | import('@baishou/shared').AgentGateAllowlistEntry[]
          | {
              allowlist: import('@baishou/shared').AgentGateAllowlistEntry[]
              scope?: import('@baishou/shared').AgentGateConfigScope
            }
      ) => {
        if (Array.isArray(payload)) {
          callback(payload)
          return
        }
        callback(payload.allowlist, payload.scope)
      }
      ipcRenderer.on('agent-gate:allowlist-changed', handler)
      return () => ipcRenderer.removeListener('agent-gate:allowlist-changed', handler)
    },
    onFocusCheck: (callback: (request: import('@baishou/shared').AgentGateRequest) => void) => {
      const handler = (_: unknown, request: import('@baishou/shared').AgentGateRequest) =>
        callback(request)
      ipcRenderer.on('agent-gate:focus-check', handler)
      return () => ipcRenderer.removeListener('agent-gate:focus-check', handler)
    },
    onNavigate: (
      callback: (payload: {
        sessionId: string
        requestId: string
        scope?: import('@baishou/shared').AgentGateConfigScope
      }) => void
    ) => {
      const handler = (_: unknown, payload: Parameters<typeof callback>[0]) => callback(payload)
      ipcRenderer.on('agent-gate:navigate', handler)
      return () => ipcRenderer.removeListener('agent-gate:navigate', handler)
    }
  },

  // RAG System
  rag: {
    getStats: () => ipcRenderer.invoke('rag:get-stats'),
    detectDimension: () => ipcRenderer.invoke('rag:detect-dimension'),
    clearDimension: () => ipcRenderer.invoke('rag:clear-dimension'),
    triggerBatchEmbed: () => ipcRenderer.invoke('rag:trigger-batch-embed'),
    consumeEmbedJobs: (reason?: string) => ipcRenderer.invoke('rag:consume-embed-jobs', reason),
    getEmbedJobsPendingCount: () => ipcRenderer.invoke('rag:embed-jobs-pending-count'),
    addManualMemory: (text: string) => ipcRenderer.invoke('rag:add-manual-memory', text),
    clearAll: () => ipcRenderer.invoke('rag:clear-all'),
    triggerMigration: (options?: { rollbackConfig?: any }) =>
      ipcRenderer.invoke('rag:trigger-migration', options),
    cancelMigration: () => ipcRenderer.invoke('rag:cancel-migration'),
    getMigrationState: () => ipcRenderer.invoke('rag:get-migration-state'),
    restoreMigrationBackup: () => ipcRenderer.invoke('rag:restore-migration-backup'),
    resumeMigration: () => ipcRenderer.invoke('rag:resume-migration'),
    queryEntries: (params: any) => ipcRenderer.invoke('rag:query-entries', params),
    deleteEntry: (id: string) => ipcRenderer.invoke('rag:delete-entry', id),
    editEntry: (params: { embeddingId: string; newText: string }) =>
      ipcRenderer.invoke('rag:edit-entry', params),
    hasPendingMigration: () => ipcRenderer.invoke('rag:has-pending-migration'),
    hasModelMismatch: () => ipcRenderer.invoke('rag:has-model-mismatch'),
    onRagProgress: (callback: (state: any) => void) => {
      const handler = (_: any, state: any) => callback(state)
      ipcRenderer.on('agent:rag-progress', handler)
      return () => ipcRenderer.off('agent:rag-progress', handler)
    },
    buildSharedContext: (lookbackMonths: number, locale?: string, userCopyPrefix?: string) =>
      ipcRenderer.invoke('summary:buildSharedContext', lookbackMonths, locale, userCopyPrefix),
    buildSharedContextPreview: (
      lookbackMonths: number,
      options?: { userCopyPrefix?: string; locale?: string }
    ) => ipcRenderer.invoke('summary:buildSharedContextPreview', lookbackMonths, options)
  }
}
