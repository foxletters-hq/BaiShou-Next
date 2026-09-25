import React, { useCallback, useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  canToggleMountedNotebook,
  getPendingMountedNotebookIds,
  isDraftNotebookMountSessionId,
  notebookMountPendingKey,
  parseMountedNotebookIds,
  setPendingMountedNotebookIds,
  toggleMountedNotebook,
  type NotebookMountCandidate
} from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Button, Checkbox, Modal, useNativeTheme } from '@baishou/ui/native'
import { mobileListMountSummaries } from '../../../services/mobile-knowledge.service'
import { agentDbRuntimeRef } from '../../../services/mobile-agent-db-runtime-ref'

export function MobileNotebookMountSheet({
  visible,
  sessionId,
  assistantId,
  onClose
}: {
  visible: boolean
  sessionId?: string | null
  assistantId?: string | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [candidates, setCandidates] = useState<NotebookMountCandidate[]>([])
  const [error, setError] = useState('')
  const draft = isDraftNotebookMountSessionId(sessionId)
  const pendingKey = notebookMountPendingKey({
    sessionId,
    assistantId,
    scope: 'companion'
  })

  const refresh = useCallback(async () => {
    setError('')
    try {
      setCandidates(await mobileListMountSummaries())
      if (draft) {
        setSelectedIds(getPendingMountedNotebookIds(pendingKey))
        return
      }
      const runtime = agentDbRuntimeRef.current
      const session = runtime && sessionId ? await runtime.sessionRepo.getSessionById(sessionId) : null
      setSelectedIds(parseMountedNotebookIds(session?.mountedNotebookIds))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [draft, pendingKey, sessionId])

  useEffect(() => {
    if (visible) void refresh()
  }, [visible, refresh])

  const persist = async (next: string[]) => {
    if (draft) {
      setSelectedIds(setPendingMountedNotebookIds(pendingKey, next))
      return
    }
    if (!sessionId) return
    const runtime = agentDbRuntimeRef.current
    if (!runtime) return
    await runtime.sessionManager.updateMountedNotebookIds(sessionId, next)
    setSelectedIds(next)
  }

  return (
    <Modal
      visible={visible}
      title={t('knowledge.notebook_mount_title')}
      onClose={onClose}
      contentMaxHeight={tokens.spacing.xl * 13}
    >
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: settingsTypography.desc.fontSize,
          fontWeight: settingsTypography.desc.fontWeight,
          marginBottom: tokens.spacing.sm
        }}
      >
        {t('knowledge.notebook_mount_hint')}
      </Text>
      {error ? (
        <Text
          style={{
            color: colors.error,
            fontSize: settingsTypography.desc.fontSize,
            marginBottom: tokens.spacing.sm
          }}
        >
          {error}
        </Text>
      ) : null}
      <ScrollView style={{ maxHeight: tokens.spacing.xl * 9 }}>
        {candidates.map((row) => {
          const selected = selectedIds.includes(row.id)
          const gate = canToggleMountedNotebook({
            selectedIds,
            candidate: row,
            candidates
          })
          const dim =
            row.dimension != null
              ? t('knowledge.notebook_mount_dimension', { count: row.dimension })
              : t('knowledge.notebook_mount_not_embedded')
          return (
            <View
              key={row.id}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: tokens.spacing.sm,
                paddingVertical: tokens.spacing.sm
              }}
            >
              <Checkbox
                selected={selected}
                disabled={!selected && !gate.allowed}
                onPress={() => {
                  const result = toggleMountedNotebook({
                    selectedIds,
                    candidateId: row.id,
                    candidates
                  })
                  if (result.error) {
                    setError(result.error)
                    return
                  }
                  void persist(result.next)
                }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: settingsTypography.row.fontSize,
                    fontWeight: settingsTypography.row.fontWeight
                  }}
                >
                  {row.name}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: settingsTypography.meta.fontSize,
                    fontWeight: settingsTypography.meta.fontWeight,
                    marginTop: tokens.spacing.xs
                  }}
                >
                  {t('knowledge.notebook_mount_meta', { count: row.sources, dim })}
                </Text>
                {!selected && gate.reason ? (
                  <Text
                    style={{
                      color: colors.textTertiary,
                      fontSize: settingsTypography.meta.fontSize,
                      marginTop: tokens.spacing.xs
                    }}
                  >
                    {gate.reason}
                  </Text>
                ) : null}
              </View>
            </View>
          )
        })}
      </ScrollView>
      <View style={{ marginTop: tokens.spacing.md }}>
        <Button onPress={onClose}>{t('common.close')}</Button>
      </View>
    </Modal>
  )
}
