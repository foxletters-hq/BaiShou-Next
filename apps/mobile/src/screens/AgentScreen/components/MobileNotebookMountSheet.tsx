import React, { useCallback, useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  canToggleMountedNotebook,
  parseMountedNotebookIds,
  toggleMountedNotebook,
  type NotebookMountCandidate
} from '@baishou/shared'
import { mobileListMountSummaries } from '../../../services/mobile-knowledge.service'
import { agentDbRuntimeRef } from '../../../services/mobile-agent-db-runtime-ref'

export function MobileNotebookMountSheet({
  visible,
  sessionId,
  onClose
}: {
  visible: boolean
  sessionId?: string | null
  onClose: () => void
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [candidates, setCandidates] = useState<NotebookMountCandidate[]>([])
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setSelectedIds([])
      setCandidates([])
      return
    }
    setError('')
    try {
      const runtime = agentDbRuntimeRef.current
      const session = runtime ? await runtime.sessionRepo.getSessionById(sessionId) : null
      setSelectedIds(parseMountedNotebookIds(session?.mountedNotebookIds))
      setCandidates(await mobileListMountSummaries())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [sessionId])

  useEffect(() => {
    if (visible) void refresh()
  }, [visible, refresh])

  const persist = async (next: string[]) => {
    if (!sessionId) return
    const runtime = agentDbRuntimeRef.current
    if (!runtime) return
    await runtime.sessionManager.updateMountedNotebookIds(sessionId, next)
    setSelectedIds(next)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.title}>知识库笔记本</Text>
          <Text style={styles.hint}>最多挂载 3 本，向量维度必须相同</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!sessionId ? (
            <Text style={styles.empty}>请先打开一个会话</Text>
          ) : (
            <ScrollView style={styles.list}>
              {candidates.map((row) => {
                const selected = selectedIds.includes(row.id)
                const gate = canToggleMountedNotebook({
                  selectedIds,
                  candidate: row,
                  candidates
                })
                const dim =
                  row.dimension != null ? `${row.dimension} 维` : '尚未嵌入'
                return (
                  <Pressable
                    key={row.id}
                    style={[styles.item, selected ? styles.itemActive : null]}
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
                  >
                    <Text style={styles.name}>{row.name}</Text>
                    <Text style={styles.meta}>
                      {row.sources} 份资料 · {dim}
                    </Text>
                    {!selected && gate.reason ? (
                      <Text style={styles.warn}>{gate.reason}</Text>
                    ) : null}
                  </Pressable>
                )
              })}
            </ScrollView>
          )}
          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>关闭</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '72%'
  },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  hint: { fontSize: 13, color: '#666', marginBottom: 10 },
  error: { fontSize: 13, color: '#c0392b', marginBottom: 8 },
  empty: { fontSize: 14, color: '#666', paddingVertical: 16 },
  list: { maxHeight: 320 },
  item: { paddingVertical: 10 },
  itemActive: { opacity: 1 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, color: '#666', marginTop: 2 },
  warn: { fontSize: 12, color: '#888', marginTop: 2 },
  close: { alignSelf: 'flex-end', paddingTop: 12 },
  closeText: { fontSize: 14, color: '#444' }
})
