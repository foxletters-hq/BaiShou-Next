import React, { useCallback, useEffect, useRef } from 'react'
import { StyleSheet } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  EmojiGroupDetailView,
  KeyboardAwareScrollView,
  scrollIndicatorStyle,
  useNativeTheme
} from '@baishou/ui/native'
import type { EmojiImportResult } from '@baishou/core-mobile'
import { findEmojiGroup, normalizeEmojiToolConfig, upsertEmojiGroup } from '@baishou/shared'
import { StackScreenLayout } from '../components/StackScreenLayout'
import { getStackScreenChrome } from '../components/stackScreenChrome'
import { useEmojiToolSettings } from '../hooks/useEmojiToolSettings'
import { useBaishou } from '../providers/BaishouProvider'
import { MobileAttachmentManagerService } from '../services/mobile-attachment-manager.service'
import { sharedTokens } from '@baishou/ui/theme/tokens'

export const EmojiGroupDetailScreen: React.FC = () => {
  const { groupId: groupIdParam } = useLocalSearchParams<{ groupId: string | string[] }>()
  const groupId = Array.isArray(groupIdParam) ? groupIdParam[0] : groupIdParam
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()
  const chrome = getStackScreenChrome(colors)
  const { services } = useBaishou()
  const { config, persist } = useEmojiToolSettings()

  const normalized = normalizeEmojiToolConfig(config)
  const group = groupId ? findEmojiGroup(normalized, groupId) : undefined

  const groupRef = useRef(group)
  groupRef.current = group
  const normalizedRef = useRef(normalized)
  normalizedRef.current = normalized
  const persistRef = useRef(persist)
  persistRef.current = persist

  // Android: 恢复 Activity 被回收前由相册选择返回的 pending 结果
  useEffect(() => {
    if (!services || !groupRef.current) return
    let cancelled = false
    void (async () => {
      const recovered = await MobileAttachmentManagerService.recoverPendingEmojiPickerResult(
        services.attachmentManager
      )
      if (cancelled || recovered.length === 0) return
      const currentGroup = groupRef.current
      if (!currentGroup) return
      const newEmojis = recovered
        .filter((r) => r.relativePath && !r.error)
        .map((r) => {
          const name =
            r.originalName ||
            r.relativePath
              .split('/')
              .pop()
              ?.replace(/\.[^.]+$/, '') ||
            ''
          return {
            id: r.relativePath.split('/').pop() || r.relativePath,
            name: name.replace(/^emoji_/, ''),
            relativePath: r.relativePath
          }
        })
      if (newEmojis.length > 0) {
        const nextGroup = {
          ...currentGroup,
          emojis: [...(currentGroup.emojis || []), ...newEmojis]
        }
        void persistRef.current(upsertEmojiGroup(normalizedRef.current, nextGroup))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [services, groupId])

  const handlePickAndImport = useCallback(async (): Promise<EmojiImportResult[]> => {
    if (!services) return []
    return MobileAttachmentManagerService.pickAndImportEmojis(services.attachmentManager)
  }, [services])

  const handleResolvePath = useCallback(
    async (relativePath: string): Promise<string> => {
      if (!services) return ''
      try {
        return await services.attachmentManager.resolveEmojiPath(relativePath)
      } catch {
        return ''
      }
    },
    [services]
  )

  const handleDelete = useCallback(
    async (relativePath: string): Promise<boolean> => {
      if (!services) return false
      return services.attachmentManager.deleteEmoji(relativePath)
    },
    [services]
  )

  return (
    <StackScreenLayout
      title={group?.name || t('agent.tools.emoji_group_detail', '表情包组')}
      {...chrome}
      contentStyle={styles.layoutContent}
    >
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        indicatorStyle={scrollIndicatorStyle(isDark)}
        keyboardShouldPersistTaps="handled"
      >
        {groupId ? (
          <EmojiGroupDetailView
            config={config}
            groupId={groupId}
            onChange={(next) => void persist(next)}
            onPickAndImport={handlePickAndImport}
            onResolvePath={handleResolvePath}
            onDelete={handleDelete}
          />
        ) : null}
      </KeyboardAwareScrollView>
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  layoutContent: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    padding: sharedTokens.spacing.md,
    paddingBottom: sharedTokens.spacing.xl
  }
})
