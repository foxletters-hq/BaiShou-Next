import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator
} from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  AgentSessionList,
  AssistantAvatar,
  useNativeTheme,
  AssistantKindBadge
} from '@baishou/ui/native'
import type { AssistantKind } from '@baishou/shared'
import type { AgentSession } from '@baishou/ui/native'

export interface AssistantSummary {
  id: string
  name: string
  description?: string
  emoji?: string
  avatarPath?: string
  displayAvatarUri?: string
  assistantKind?: AssistantKind
}

interface AgentDrawerProps {
  visible: boolean
  onClose: () => void
  currentAssistant: AssistantSummary | null
  pinnedAssistants: AssistantSummary[]
  sessions: AgentSession[]
  sessionListScrollKey: number
  hasMoreSessions: boolean
  isLoadingMoreSessions: boolean
  onLoadMoreSessions: () => void
  onRefreshSessions: () => void
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
const DRAWER_OPEN_MS = 260
const DRAWER_CLOSE_MS = 220
const DRAWER_EASE = Easing.bezier(0.4, 0, 0.2, 1)

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

function AgentDrawerComponent({
  visible,
  onClose,
  currentAssistant,
  pinnedAssistants,
  sessions,
  sessionListScrollKey,
  hasMoreSessions,
  isLoadingMoreSessions,
  onLoadMoreSessions,
  onRefreshSessions,
  selectedSessionId,
  onSelectSession,
  onCreateSession,
  onShowAssistantPicker,
  onSelectAssistant,
  onPinSession,
  onDeleteSession,
  onRenameSession
}: AgentDrawerProps) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [listReady, setListReady] = useState(false)
  const sessionListMountedRef = useRef(false)
  const slideX = useSharedValue(-DRAWER_WIDTH)
  const backdropOpacity = useSharedValue(0)

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value
  }))

  const drawerSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }]
  }))

  const finishClose = useCallback(() => {
    setMounted(false)
    setListReady(false)
    sessionListMountedRef.current = false
  }, [])

  const onOpenAnimationEnd = useCallback(() => {
    if (sessionListMountedRef.current) return
    sessionListMountedRef.current = true
    setListReady(true)
  }, [])

  useLayoutEffect(() => {
    if (!visible) return

    cancelAnimation(slideX)
    cancelAnimation(backdropOpacity)
    slideX.value = -DRAWER_WIDTH
    backdropOpacity.value = 0
    setMounted(true)
  }, [visible, slideX, backdropOpacity])

  useEffect(() => {
    if (!mounted) return

    cancelAnimation(slideX)
    cancelAnimation(backdropOpacity)

    if (visible) {
      slideX.value = withTiming(0, { duration: DRAWER_OPEN_MS, easing: DRAWER_EASE }, (finished) => {
        if (finished) runOnJS(onOpenAnimationEnd)()
      })
      backdropOpacity.value = withTiming(1, {
        duration: DRAWER_OPEN_MS,
        easing: DRAWER_EASE
      })
      return
    }

    slideX.value = withTiming(
      -DRAWER_WIDTH,
      { duration: DRAWER_CLOSE_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishClose)()
      }
    )
    backdropOpacity.value = withTiming(0, {
      duration: DRAWER_CLOSE_MS,
      easing: Easing.in(Easing.cubic)
    })
  }, [visible, mounted, slideX, backdropOpacity, finishClose, onOpenAnimationEnd])

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
    onRefreshSessions()
  }

  const handleDelete = async (id: string) => {
    onDeleteSession(id)
    onRefreshSessions()
  }

  const handleRename = async (id: string, title: string) => {
    onRenameSession(id, title)
    onRefreshSessions()
  }

  const handleLoadMore = useCallback(() => {
    onLoadMoreSessions()
  }, [onLoadMoreSessions])

  if (!mounted) return null

  return (
    <Modal
      visible={mounted}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.drawerWrap,
            {
              top: insets.top,
              bottom: 0
            },
            drawerSlideStyle
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
                    <View style={styles.currentNameRow}>
                      <Text
                        style={[styles.currentName, { color: colors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {currentAssistant.name}
                      </Text>
                      <AssistantKindBadge kind={currentAssistant.assistantKind} compact />
                    </View>
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
              {listReady ? (
                <AgentSessionList
                  sessions={sessions}
                  scrollKey={sessionListScrollKey}
                  onSelect={handleSelect}
                  onPin={handlePin}
                  onDelete={handleDelete}
                  onRename={handleRename}
                  hasMore={hasMoreSessions}
                  isLoadingMore={isLoadingMoreSessions}
                  onLoadMore={handleLoadMore}
                />
              ) : (
                <View style={styles.listPlaceholder}>
                  <ActivityIndicator size="small" color={colors.textTertiary} />
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

export const AgentDrawer = React.memo(AgentDrawerComponent)

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
  currentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap'
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
  },
  listPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24
  }
})
