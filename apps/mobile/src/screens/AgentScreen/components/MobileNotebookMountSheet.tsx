import React, { useCallback, useEffect, useState } from 'react'
import { Image, Pressable, ScrollView, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  canToggleMountedNotebook,
  getNotebookCardAppearance,
  getPendingMountedNotebookIds,
  isDraftNotebookMountSessionId,
  notebookMountPendingKey,
  parseMountedNotebookIds,
  setPendingMountedNotebookIds,
  toggleMountedNotebook,
  type NotebookMountCandidate
} from '@baishou/shared'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import { Button, Checkbox, Modal, modalActionsStyle, useNativeTheme } from '@baishou/ui/native'
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
      const session =
        runtime && sessionId ? await runtime.sessionRepo.getSessionById(sessionId) : null
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
          fontSize: mobileTypography.secondary.fontSize,
          fontWeight: mobileTypography.secondary.fontWeight,
          marginBottom: tokens.spacing.sm
        }}
      >
        {t('knowledge.notebook_mount_hint')}
      </Text>
      {error ? (
        <Text
          style={{
            color: colors.error,
            fontSize: mobileTypography.secondary.fontSize,
            marginBottom: tokens.spacing.sm
          }}
        >
          {error}
        </Text>
      ) : null}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: tokens.spacing.xl * 9 }}
        contentContainerStyle={{ paddingRight: tokens.spacing.mdTight }}
      >
        {candidates.map((row) => {
          const selected = selectedIds.includes(row.id)
          const gate = canToggleMountedNotebook({
            selectedIds,
            candidate: row,
            candidates
          })
          const disabled = !selected && !gate.allowed
          const appearance = getNotebookCardAppearance(row.id, {
            coverTone: row.coverTone,
            coverIcon: row.coverIcon
          })
          const handleToggle = () => {
            if (disabled) return
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
          }

          return (
            <Pressable
              key={row.id}
              onPress={handleToggle}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled }}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: tokens.spacing.sm,
                  paddingVertical: tokens.spacing.sm,
                  opacity: disabled ? 0.6 : pressed ? 0.7 : 1
                }
              ]}
            >
              <View pointerEvents="none">
                <Checkbox selected={selected} disabled={disabled} />
              </View>
              <View
                style={{
                  width: tokens.spacing.xl,
                  height: tokens.spacing.xl,
                  borderRadius: tokens.radius.xs,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.bgSurface
                }}
              >
                {row.coverImageUrl ? (
                  <Image
                    source={{ uri: row.coverImageUrl }}
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <Text>{appearance.icon}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: mobileTypography.primary.fontSize,
                    fontWeight: mobileTypography.primary.fontWeight
                  }}
                >
                  {row.name}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: mobileTypography.caption.fontSize,
                    fontWeight: mobileTypography.caption.fontWeight,
                    marginTop: tokens.spacing.xs
                  }}
                >
                  {t('knowledge.notebook_mount_counts', '向量 {{vectors}} · 图谱 {{graphs}}', {
                    vectors: row.chunks,
                    graphs: row.graphNodes ?? 0
                  })}
                </Text>
                {!selected && gate.reason ? (
                  <Text
                    style={{
                      color: colors.textTertiary,
                      fontSize: mobileTypography.caption.fontSize,
                      marginTop: tokens.spacing.xs
                    }}
                  >
                    {gate.reason}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )
        })}
      </ScrollView>
      <View style={modalActionsStyle}>
        {selectedIds.length > 0 ? (
          <Button
            size="sm"
            variant="outlined"
            onPress={() => {
              void persist([])
            }}
          >
            {t('knowledge.notebook_mount_clear', '取消全部挂载')}
          </Button>
        ) : null}
        <Button size="sm" variant="outlined" onPress={onClose}>
          {t('common.close')}
        </Button>
      </View>
    </Modal>
  )
}
