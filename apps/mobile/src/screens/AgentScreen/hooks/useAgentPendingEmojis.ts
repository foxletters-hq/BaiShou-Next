import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  normalizeEmojiToolConfig,
  resolveAssistantEmojiConfig,
  type ToolManagementConfig
} from '@baishou/shared'
import { resolvePendingEmoji } from '../utils/resolve-pending-emoji.util'
import type { useBaishou } from '../../../providers/BaishouProvider'
import type { useAgentStream } from '../../../hooks/useAgentStream'

type Baishou = ReturnType<typeof useBaishou>
type Stream = ReturnType<typeof useAgentStream>
type Assistant = { emojiEnabled?: boolean; emojiGroupIds?: string[] } | null | undefined

export function useAgentPendingEmojis(
  services: Baishou['services'],
  currentAssistant: Assistant,
  pendingEmojis: Stream['pendingEmojis']
) {
  const [emojiToolConfig, setEmojiToolConfig] = useState(
    normalizeEmojiToolConfig({ enabled: false, groups: [] })
  )
  const [pendingEmojiUris, setPendingEmojiUris] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!services) return
    void (async () => {
      try {
        const toolConfig =
          await services.settingsManager.get<ToolManagementConfig>('tool_management_config')
        if (toolConfig?.emojiConfig) {
          setEmojiToolConfig(normalizeEmojiToolConfig(toolConfig.emojiConfig))
        }
      } catch {
        // Ignore errors loading emoji config
      }
    })()
  }, [services])

  const resolvedEmojiConfig = useMemo(
    () =>
      resolveAssistantEmojiConfig(emojiToolConfig, {
        emojiEnabled: currentAssistant?.emojiEnabled,
        emojiGroupIds: currentAssistant?.emojiGroupIds
      }),
    [emojiToolConfig, currentAssistant?.emojiEnabled, currentAssistant?.emojiGroupIds]
  )

  const assistantEmojis = resolvedEmojiConfig.emojis

  const resolvePending = useCallback(
    (query: string) => resolvePendingEmoji(query, assistantEmojis),
    [assistantEmojis]
  )

  useEffect(() => {
    if (!services || pendingEmojis.length === 0) {
      setPendingEmojiUris({})
      return
    }
    let cancelled = false
    void (async () => {
      const next: Record<string, string> = {}
      for (const pending of pendingEmojis) {
        const emoji = resolvePending(pending.emojiId)
        if (!emoji) continue
        try {
          next[pending.emojiId] = await services.attachmentManager.resolveEmojiPath(
            emoji.relativePath
          )
        } catch (e) {
          console.warn('[AgentScreen] Failed to resolve pending emoji path:', emoji.relativePath, e)
        }
      }
      if (!cancelled) {
        setPendingEmojiUris(next)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pendingEmojis, services, resolvePending])

  const pendingEmojiAttachments = useMemo(() => {
    if (pendingEmojis.length === 0 || assistantEmojis.length === 0) return []
    return pendingEmojis
      .map((pending) => {
        const emoji = resolvePending(pending.emojiId)
        const uri = pendingEmojiUris[pending.emojiId]
        if (!emoji || !uri) return null
        return {
          id: emoji.id,
          fileName: emoji.name || emoji.id,
          filePath: uri,
          isImage: true,
          isPdf: false
        }
      })
      .filter((item): item is NonNullable<typeof item> => item != null)
  }, [pendingEmojis, assistantEmojis, resolvePending, pendingEmojiUris])

  return { pendingEmojiAttachments }
}
