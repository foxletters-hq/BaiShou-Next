import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Modal, Pressable, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { AgentSessionList, AssistantAvatar, useNativeTheme } from '@baishou/ui/native'
import type { AgentSession } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'

export interface AssistantSummary {
  id: string
  name: string
  description?: string
  emoji?: string
  avatarPath?: string
  displayAvatarUri?: string
}

interface AgentDrawerProps {
  visible: boolean
  onClose: () => void
  currentAssistant: AssistantSummary | null
  pinnedAssistants: AssistantSummary[]
  selectedSessionId?: string
  onSelectSession: (sessionId: string) => void
  onCreateSession: () => void
  onShowAssistantPicker: () => void
  onSelectAssistant: (assistant: AssistantSummary) => void
  onPinSession: (sessionId: string, isPinned: boolean) => void
  onDeleteSession: (sessionId: string) => void
  onRenameSession: (sessionId: string, title: string) => void
}

const DRAWER_WIDTH = 280
/** 每页 10 条；多取 1 条用于判断是否还有下一页（对齐桌面端 useAgentSessions） */
const SESSION_PAGE_SIZE = 10

function DrawerAssistantAvatar({ assistant, size }: { assistant: AssistantSummary; size: number }) {
  return (
    <AssistantAvatar
      emoji={assistant.emoji}
      avatarPath={assistant.avatarPath}
      resolvedAvatarUri={assistant.displayAvatarUri}
      size={size}
    />
  )
}

export const AgentDrawer: React.FC<AgentDrawerProps> = ({
  visible,
  onClose,
  currentAssistant,
  pinnedAssistants,
  selectedSessionId,
  onSelectSession,
  onCreateSession,
  onShowAssistantPicker,
  onSelectAssistant,
  onPinSession,
  onDeleteSession,
  onRenameSession
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { services, dbReady } = useBaishou()
  const [sessions, setSessions] = useState<AgentSession[]>([])
  const [hasMoreSessions, setHasMoreSessions] = useState(false)
  const [isLoadingMoreSessions, setIsLoadingMoreSessions] = useState(false)
  const [mounted, setMounted] = useState(false)
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const sessionsLoadedFromDbRef = useRef(0)
  const lastLoadRequestId = useRef(0)

  const mapSession = useCallback(
    (s: any): AgentSession => ({
      id: s.id,
      title: s.title || t('agent.sessions.default_title', '新对话'),
      isPinned: Boolean(s.isPinned),
      lastMessageAt: s.updatedAt
        ? new Date(s.updatedAt).getTime()
        : s.createdAt
          ? new Date(s.createdAt).getTime()
          : Date.now(),
      messageCount: s.messageCount ?? 0
    }),
    [t]
  )

  const loadSessions = useCallback(
    async (resetOffset = true) => {
      if (!dbReady || !services || !currentAssistant?.id) return

      const reqId = ++lastLoadRequestId.current
      const offset = resetOffset ? 0 : sessionsLoadedFromDbRef.current
      const assistantId = currentAssistant.id

      if (!resetOffset) {
        setIsLoadingMoreSessions(true)
      }

      try {
        const sessionList = await services.sessionManager.list(
          SESSION_PAGE_SIZE + 1,
          offset,
          assistantId
        )

        if (reqId !== lastLoadRequestId.current) return

        if (sessionList && sessionList.length > 0) {
          const hasMore = sessionList.length > SESSION_PAGE_SIZE
          const page = hasMore ? sessionList.slice(0, SESSION_PAGE_SIZE) : sessionList
          const mapped = page.map(mapSession)

          if (resetOffset) {
            setSessions(mapped)
            sessionsLoadedFromDbRef.current = sessionList.length
          } else {
            setSessions((prev) => {
              const existing = new Set(prev.map((s) => s.id))
              const merged = [...prev]
              for (const row of mapped) {
                if (!existing.has(row.id)) merged.push(row)
              }
              return merged
            })
            sessionsLoadedFromDbRef.current += sessionList.length
          }
          setHasMoreSessions(hasMore)
        } else {
          if (resetOffset) {
            setSessions([])
            sessionsLoadedFromDbRef.current = 0
          }
          setHasMoreSessions(false)
        }
      } catch (e) {
        console.warn('Failed to load sessions', e)
      } finally {
        if (reqId === lastLoadRequestId.current) {
          setIsLoadingMoreSessions(false)
        }
      }
    },
    [dbReady, services, currentAssistant?.id, mapSession]
  )

  useEffect(() => {
    if (!visible || !currentAssistant?.id) return
    lastLoadRequestId.current += 1
    sessionsLoadedFromDbRef.current = 0
    setSessions([])
    setHasMoreSessions(false)
    void loadSessions(true)
  }, [visible, currentAssistant?.id, loadSessions])

  useEffect(() => {
    if (visible) {
      setMounted(true)
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true
        })
      ]).start()
      return
    }

    if (!mounted) return

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 220,
        useNativeDriver: true
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true
      })
    ]).start(({ finished }) => {
      if (finished) setMounted(false)
    })
  }, [visible, mounted, slideAnim, fadeAnim])

  const handleSelect = (id: string) => {
    onSelectSession(id)
    onClose()
  }

  const handleCreate = () => {
    onCreateSession()
    onClose()
  }

  const handlePin = async (id: string) => {
    const session = sessions.find((s) => s.id === id)
    if (session) onPinSession(id, session.isPinned)
    await loadSessions(true)
  }

  const handleDelete = async (id: string) => {
    onDeleteSession(id)
    await loadSessions(true)
  }

  const handleRename = async (id: string, title: string) => {
    onRenameSession(id, title)
    await loadSessions(true)
  }

  const handleLoadMore = useCallback(() => {
    void loadSessions(false)
  }, [loadSessions])

  if (!mounted) return null

  return (
    <Modal visible={mounted} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.drawerWrap,
            {
              top: insets.top,
              bottom: 0,
              transform: [{ translateX: slideAnim }]
            }
          ]}
        >
          <View
            style={[
              styles.drawer,
              {
                width: DRAWER_WIDTH,
                backgroundColor: colors.bgSurface,
                borderRightColor: colors.borderSubtle
              }
            ]}
          >
            <TouchableOpacity
              style={[styles.currentCard, { backgroundColor: colors.bgSurfaceHighest }]}
              onPress={() => {
                onShowAssistantPicker()
                onClose()
              }}
              activeOpacity={0.7}
            >
              {currentAssistant ? (
                <>
                  <DrawerAssistantAvatar assistant={currentAssistant} size={36} />
                  <View style={styles.currentMeta}>
                    <Text
                      style={[styles.currentName, { color: colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {currentAssistant.name}
                    </Text>
                    {currentAssistant.description ? (
                      <Text
                        style={[styles.currentDesc, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {currentAssistant.description}
                      </Text>
                    ) : null}
                  </View>
                  <MaterialIcons name="unfold-more" size={20} color={colors.textSecondary} />
                </>
              ) : (
                <>
                  <View
                    style={[styles.avatarSkeleton, { backgroundColor: colors.bgSurfaceNormal }]}
                  />
                  <View style={styles.currentMeta}>
                    <View
                      style={[styles.lineSkeleton, { backgroundColor: colors.bgSurfaceNormal }]}
                    />
                    <View
                      style={[
                        styles.lineSkeleton,
                        styles.lineSkeletonShort,
                        { backgroundColor: colors.bgSurfaceNormal }
                      ]}
                    />
                  </View>
                  <MaterialIcons name="unfold-more" size={20} color={colors.textTertiary} />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.pinnedRow}>
              {pinnedAssistants.length === 0 ? (
                <Text style={[styles.pinHint, { color: colors.textSecondary }]} numberOfLines={1}>
                  {t('agent.sidebar.pin_hint', '这里可以置顶伙伴')}
                </Text>
              ) : (
                pinnedAssistants.map((assistant) => {
                  const isSelected = currentAssistant?.id === assistant.id
                  return (
                    <TouchableOpacity
                      key={assistant.id}
                      style={[
                        styles.pinnedAvatar,
                        isSelected && {
                          borderColor: colors.primary,
                          backgroundColor: colors.primaryContainer
                        }
                      ]}
                      onPress={() => {
                        if (!isSelected) {
                          onSelectAssistant(assistant)
                          onClose()
                        }
                      }}
                      accessibilityLabel={assistant.name}
                    >
                      <DrawerAssistantAvatar assistant={assistant} size={36} />
                    </TouchableOpacity>
                  )
                })
              )}
            </View>

            <TouchableOpacity
              style={[styles.newChatBtn, { backgroundColor: colors.primary }]}
              onPress={handleCreate}
            >
              <MaterialIcons name="add" size={20} color={colors.textOnPrimary} />
              <Text style={[styles.newChatText, { color: colors.textOnPrimary }]}>
                {t('agent.sessions.new_chat', '新对话')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => {
                onClose()
                router.push('/(tabs)/settings')
              }}
            >
              <MaterialIcons name="settings" size={20} color={colors.textSecondary} />
              <Text style={[styles.settingsText, { color: colors.textPrimary }]}>
                {t('settings.title', '系统设置')}
              </Text>
            </TouchableOpacity>

            <View style={styles.historyHeader}>
              <Text style={[styles.historyTitle, { color: colors.textSecondary }]}>
                {t('agent.sidebar.recent_chats', '最近对话')}
              </Text>
            </View>

            <View style={styles.listWrap}>
              <AgentSessionList
                sessions={sessions}
                onSelect={handleSelect}
                onPin={handlePin}
                onDelete={handleDelete}
                onRename={handleRename}
                hasMore={hasMoreSessions}
                isLoadingMore={isLoadingMoreSessions}
                onLoadMore={handleLoadMore}
              />
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)'
  },
  drawerWrap: {
    position: 'absolute',
    left: 0
  },
  drawer: {
    flex: 1,
    borderRightWidth: 1,
    paddingTop: 12
  },
  currentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    gap: 10
  },
  currentMeta: {
    flex: 1
  },
  currentName: {
    fontSize: 15,
    fontWeight: '700'
  },
  currentDesc: {
    fontSize: 12,
    marginTop: 2
  },
  avatarShell: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarEmoji: {
    textAlign: 'center'
  },
  avatarSkeleton: {
    width: 36,
    height: 36,
    borderRadius: 18
  },
  lineSkeleton: {
    height: 10,
    borderRadius: 4,
    width: 80
  },
  lineSkeletonShort: {
    width: 56,
    marginTop: 6
  },
  pinnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    minHeight: 44
  },
  pinHint: {
    fontSize: 12,
    flex: 1
  },
  pinnedAvatar: {
    padding: 2,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 10,
    borderRadius: 10
  },
  newChatText: {
    fontSize: 15,
    fontWeight: '700'
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 4
  },
  settingsText: {
    fontSize: 15,
    fontWeight: '500'
  },
  historyHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase'
  },
  listWrap: {
    flex: 1
  }
})
