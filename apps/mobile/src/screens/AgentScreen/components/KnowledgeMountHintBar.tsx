import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getPendingMountedNotebookIds,
  isDraftNotebookMountSessionId,
  notebookMountPendingKey,
  parseMountedNotebookIds
} from '@baishou/shared'
import { Button } from '@baishou/ui/native'
import { mobileListMountSummaries } from '../../../services/mobile-knowledge.service'
import { agentDbRuntimeRef } from '../../../services/mobile-agent-db-runtime-ref'

export function KnowledgeMountHintBar(props: {
  sessionId?: string | null
  assistantId?: string | null
  refreshToken?: boolean
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const [names, setNames] = useState<string[]>([])
  const draft = isDraftNotebookMountSessionId(props.sessionId)
  const pendingKey = notebookMountPendingKey({
    sessionId: props.sessionId,
    assistantId: props.assistantId,
    scope: 'companion'
  })

  const refresh = useCallback(async () => {
    const candidates = await mobileListMountSummaries()
    const selected = draft
      ? getPendingMountedNotebookIds(pendingKey)
      : parseMountedNotebookIds(
          props.sessionId
            ? (await agentDbRuntimeRef.current?.sessionRepo.getSessionById(props.sessionId))
                ?.mountedNotebookIds
            : undefined
        )
    setNames(
      selected
        .map((id) => candidates.find((row) => row.id === id)?.name)
        .filter((name): name is string => Boolean(name))
    )
  }, [draft, pendingKey, props.sessionId])

  useEffect(() => {
    void refresh().catch(() => setNames([]))
  }, [refresh, props.refreshToken])

  if (names.length === 0) return null
  return (
    <Button variant="outlined" onPress={props.onOpen}>
      {t('agent.mounted_notebooks', '已挂载 {{names}}', { names: names.join('、') })}
    </Button>
  )
}
