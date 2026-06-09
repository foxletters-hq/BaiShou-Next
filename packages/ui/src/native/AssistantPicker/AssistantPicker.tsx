import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  Animated,
  StyleSheet,
  TouchableOpacity
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { AssistantAvatar } from '../AssistantAvatar'

export interface MockAgentAssistant {
  id: string
  name: string
  description: string
  emoji?: string
  avatarPath?: string
  /** 已解析的本地展示 URI（相对路径 avatars/ 时使用） */
  displayAvatarUri?: string
  systemPrompt?: string
  providerId?: string
  modelId?: string
  contextWindow?: number
  compressTokenThreshold?: number
}

interface NativeAssistantPickerProps {
  isOpen: boolean
  onClose: () => void
  assistants: MockAgentAssistant[]
  currentAssistantId?: string | null
  onSelect: (assistant: MockAgentAssistant) => void
  onSettingsPress?: () => void
  onCreatePress?: () => void
}

export const AssistantPicker: React.FC<NativeAssistantPickerProps> = ({
  isOpen,
  onClose,
  assistants,
  currentAssistantId,
  onSelect,
  onSettingsPress,
  onCreatePress
}) => {
  const { t } = useTranslation()
  const { colors, tokens, maxModalWidth } = useNativeTheme()
  const scaleAnim = useRef(new Animated.Value(0.85)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const [mounted, setMounted] = React.useState(false)

  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        })
      ]).start()
      return
    }

    if (!mounted) return

    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 180,
        useNativeDriver: true
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true
      })
    ]).start(({ finished }) => {
      if (finished) setMounted(false)
    })
  }, [isOpen, mounted, scaleAnim, fadeAnim])

  if (!mounted) return null

  const handleSelect = (assistant: MockAgentAssistant) => {
    onSelect(assistant)
    onClose()
  }

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.dialog,
            {
              backgroundColor: colors.bgSurface,
              borderRadius: tokens.radius.xl,
              width: '90%',
              maxWidth: maxModalWidth,
              maxHeight: '80%',
              padding: tokens.spacing.lg,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <View style={styles.header}>
            <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {t('agent.assistant.select_title', '选择伙伴')}
            </Text>
            <View style={styles.headerSpacer} />
            {onSettingsPress && (
              <TouchableOpacity
                onPress={() => {
                  onClose()
                  onSettingsPress()
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={t('agent.assistant.settings_entry', '伙伴管理')}
              >
                <MaterialIcons name="settings" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {assistants.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {t('agent.assistant.empty_hint', '还没有伙伴，创建一个吧')}
                </Text>
                {onCreatePress && (
                  <TouchableOpacity
                    style={[styles.createBtn, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      onClose()
                      onCreatePress()
                    }}
                  >
                    <MaterialIcons name="add" size={18} color={colors.textOnPrimary} />
                    <Text style={[styles.createBtnText, { color: colors.textOnPrimary }]}>
                      {t('agent.assistant.create_first', '创建第一个伙伴')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              assistants.map((assistant) => {
                const isSelected = assistant.id === currentAssistantId
                return (
                  <TouchableOpacity
                    key={assistant.id}
                    style={[
                      styles.card,
                      {
                        backgroundColor: isSelected
                          ? colors.primaryContainer
                          : colors.bgSurfaceNormal,
                        borderColor: isSelected ? colors.primary : colors.borderSubtle
                      }
                    ]}
                    onPress={() => handleSelect(assistant)}
                    activeOpacity={0.7}
                  >
                    <AssistantAvatar
                      emoji={assistant.emoji}
                      avatarPath={assistant.avatarPath}
                      resolvedAvatarUri={assistant.displayAvatarUri}
                      size={40}
                    />
                    <View style={styles.cardBody}>
                      <Text
                        style={[
                          styles.cardTitle,
                          {
                            color: isSelected ? colors.onPrimaryContainer : colors.textPrimary
                          }
                        ]}
                        numberOfLines={1}
                      >
                        {assistant.name}
                      </Text>
                      {assistant.description ? (
                        <Text
                          style={[styles.cardDesc, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {assistant.description}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected && (
                      <MaterialIcons name="check-circle" size={22} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                )
              })
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)'
  },
  dialog: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700'
  },
  headerSpacer: {
    flex: 1
  },
  list: {
    maxHeight: 420
  },
  listContent: {
    paddingBottom: 8,
    gap: 8
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 16
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center'
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10
  },
  createBtnText: {
    fontSize: 15,
    fontWeight: '600'
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarEmoji: {
    fontSize: 20
  },
  cardBody: {
    flex: 1
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600'
  },
  cardDesc: {
    fontSize: 13,
    marginTop: 2
  }
})
