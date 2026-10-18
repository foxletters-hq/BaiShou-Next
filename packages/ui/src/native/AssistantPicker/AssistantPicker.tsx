import React, { memo, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  StyleSheet,
  TouchableOpacity
} from 'react-native'
import { CheckCircle2, Plus, Settings, Sparkles } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { AssistantAvatar } from '../AssistantAvatar'
import { AssistantKindBadge } from '../AssistantKindBadge'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

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
  compressKeepTurns?: number
  compressSystemPrompt?: string | null
  assistantKind?: 'companion' | 'work'
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

const AssistantPickerRow = memo(function AssistantPickerRow({
  assistant,
  isSelected,
  onSelect,
  colors
}: {
  assistant: MockAgentAssistant
  isSelected: boolean
  onSelect: (assistant: MockAgentAssistant) => void
  colors: ReturnType<typeof useNativeTheme>['colors']
}) {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: isSelected ? colors.primaryContainer : colors.bgSurfaceNormal,
          borderColor: isSelected ? colors.primary : colors.borderSubtle
        }
      ]}
      onPress={() => onSelect(assistant)}
      activeOpacity={0.7}
    >
      <AssistantAvatar
        emoji={assistant.emoji}
        avatarPath={assistant.avatarPath}
        resolvedAvatarUri={assistant.displayAvatarUri}
        size={40}
      />
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
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
          <AssistantKindBadge kind={assistant.assistantKind} compact />
        </View>
        {assistant.description ? (
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={1}>
            {assistant.description}
          </Text>
        ) : null}
      </View>
      {isSelected ? (
        <CheckCircle2 size={22} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
      ) : null}
    </TouchableOpacity>
  )
})

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

  const handleSelect = useCallback(
    (assistant: MockAgentAssistant) => {
      onSelect(assistant)
      onClose()
    },
    [onSelect, onClose]
  )

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View
          style={[
            styles.dialog,
            {
              backgroundColor: colors.bgSurface,
              borderRadius: tokens.radius.xl,
              width: '90%',
              maxWidth: maxModalWidth,
              maxHeight: '80%',
              padding: tokens.spacing.lg
            }
          ]}
        >
          <View style={styles.header}>
            <Sparkles size={20} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {t('agent.assistant.select_title', '选择伙伴')}
            </Text>
            <View style={styles.headerSpacer} />
            {onSettingsPress ? (
              <TouchableOpacity
                onPress={() => {
                  onClose()
                  onSettingsPress()
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={t('agent.assistant.settings_entry', '伙伴管理')}
              >
                <Settings
                  size={22}
                  color={colors.textSecondary}
                  strokeWidth={DEFAULT_STROKE_WIDTH}
                />
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          >
            {assistants.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {t('agent.assistant.empty_hint', '还没有伙伴，创建一个吧')}
                </Text>
                {onCreatePress ? (
                  <TouchableOpacity
                    style={[styles.createBtn, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      onClose()
                      onCreatePress()
                    }}
                  >
                    <Plus
                      size={18}
                      color={colors.textOnPrimary}
                      strokeWidth={DEFAULT_STROKE_WIDTH}
                    />
                    <Text style={[styles.createBtnText, { color: colors.textOnPrimary }]}>
                      {t('agent.assistant.create_first', '创建第一个伙伴')}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              assistants.map((assistant) => (
                <AssistantPickerRow
                  key={assistant.id}
                  assistant={assistant}
                  isSelected={assistant.id === currentAssistantId}
                  onSelect={handleSelect}
                  colors={colors}
                />
              ))
            )}
          </ScrollView>
        </View>
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
    gap: sharedTokens.spacing.smPlus,
    paddingBottom: sharedTokens.spacing.mdTight
  },
  headerTitle: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600'
  },
  headerSpacer: {
    flex: 1
  },
  list: {
    maxHeight: 420
  },
  listContent: {
    paddingBottom: sharedTokens.spacing.sm,
    paddingRight: sharedTokens.spacing.mdTight,
    gap: sharedTokens.spacing.sm
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: sharedTokens.spacing.xl,
    gap: sharedTokens.spacing.md
  },
  emptyText: {
    fontSize: mobileTypography.body.fontSize,
    textAlign: 'center'
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus,
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.control
  },
  createBtnText: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '600'
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sharedTokens.spacing.mdSnug,
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1,
    gap: sharedTokens.spacing.mdTight
  },
  cardBody: {
    flex: 1
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus,
    flexWrap: 'wrap'
  },
  cardTitle: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '600',
    flexShrink: 1
  },
  cardDesc: {
    fontSize: mobileTypography.secondary.fontSize,
    marginTop: sharedTokens.spacing.xxs
  }
})
