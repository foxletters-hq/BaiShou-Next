import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator
} from 'react-native'
import { Plus, Settings, Sparkles, X } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { AssistantAvatar } from '../AssistantAvatar'
import { AssistantKindBadge } from '../AssistantKindBadge'
import { AssistantPickerMemoryPanel } from './AssistantPickerMemoryPanel'
import type {
  AssistantPickerSheetAssistant,
  AssistantPickerSheetProps
} from './assistant-picker-sheet.types'

export type {
  AssistantPickerSheetAssistant,
  AssistantPickerSheetProps,
  AssistantMemoryConfigPatch
} from './assistant-picker-sheet.types'

export const AssistantPickerSheet: React.FC<AssistantPickerSheetProps> = ({
  isOpen,
  onClose,
  assistants,
  currentAssistantId,
  onSelect,
  onSaveMemoryConfig,
  onSettingsPress,
  onCreatePress
}) => {
  const { t } = useTranslation()
  const { colors, tokens, maxModalWidth } = useNativeTheme()
  const [selectedId, setSelectedId] = useState<string | null>(currentAssistantId ?? null)
  const [isSavingMemory, setIsSavingMemory] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setSelectedId(currentAssistantId ?? assistants[0]?.id ?? null)
  }, [isOpen, currentAssistantId, assistants])

  const selectedAssistant = useMemo(
    () => assistants.find((a) => a.id === selectedId) ?? null,
    [assistants, selectedId]
  )

  const handleSaveMemoryConfig = useCallback(
    async (assistantId: string, updates: Parameters<NonNullable<typeof onSaveMemoryConfig>>[1]) => {
      if (!onSaveMemoryConfig) return
      setIsSavingMemory(true)
      try {
        await onSaveMemoryConfig(assistantId, updates)
      } finally {
        setIsSavingMemory(false)
      }
    },
    [onSaveMemoryConfig]
  )

  const handleConfirmSelect = useCallback(() => {
    if (!selectedAssistant) return
    onSelect(selectedAssistant)
    onClose()
  }, [onClose, onSelect, selectedAssistant])

  if (!isOpen) return null

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bgSurface,
              maxWidth: maxModalWidth
            }
          ]}
        >
          <View style={styles.handle}>
            <View style={[styles.handleBar, { backgroundColor: colors.borderSubtle }]} />
          </View>

          <View style={styles.header}>
            <Sparkles size={20} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {t('agent.assistant.select_title', '选择伙伴')}
            </Text>
            <View style={styles.headerSpacer} />
            {onSettingsPress ? (
              <TouchableOpacity
                onPress={onSettingsPress}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Settings
                  size={22}
                  color={colors.textSecondary}
                  strokeWidth={DEFAULT_STROKE_WIDTH}
                />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={22} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
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
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.assistantRow}
                >
                  {assistants.map((assistant) => {
                    const active = assistant.id === selectedId
                    return (
                      <TouchableOpacity
                        key={assistant.id}
                        style={[
                          styles.assistantChip,
                          {
                            backgroundColor: active
                              ? colors.primaryContainer
                              : colors.bgSurfaceNormal,
                            borderColor: active ? colors.primary : colors.borderSubtle
                          }
                        ]}
                        onPress={() => setSelectedId(assistant.id)}
                        activeOpacity={0.85}
                      >
                        <AssistantAvatar
                          emoji={assistant.emoji}
                          avatarPath={assistant.avatarPath}
                          resolvedAvatarUri={assistant.displayAvatarUri}
                          size={32}
                        />
                        <View style={styles.chipTextWrap}>
                          <Text
                            style={[
                              styles.chipTitle,
                              { color: active ? colors.onPrimaryContainer : colors.textPrimary }
                            ]}
                            numberOfLines={1}
                          >
                            {assistant.name}
                          </Text>
                          <AssistantKindBadge kind={assistant.assistantKind} compact />
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>

                {onSaveMemoryConfig ? (
                  <AssistantPickerMemoryPanel
                    assistant={selectedAssistant}
                    isSaving={isSavingMemory}
                    onSaveMemoryConfig={handleSaveMemoryConfig}
                  />
                ) : null}
              </>
            )}
          </ScrollView>

          {assistants.length > 0 ? (
            <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  {
                    backgroundColor: selectedAssistant ? colors.primary : colors.bgSurfaceNormal,
                    opacity: selectedAssistant ? 1 : 0.6
                  }
                ]}
                disabled={!selectedAssistant}
                onPress={handleConfirmSelect}
                activeOpacity={0.9}
              >
                <Text
                  style={[
                    styles.confirmBtnText,
                    { color: selectedAssistant ? colors.textOnPrimary : colors.textSecondary }
                  ]}
                >
                  {t('agent.assistant.use_selected', '使用此伙伴')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  sheet: {
    width: '100%',
    maxHeight: '88%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden'
  },
  handle: {
    alignItems: 'center',
    paddingTop: 10
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700'
  },
  headerSpacer: {
    flex: 1
  },
  body: {
    flexGrow: 0,
    flexShrink: 1
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16
  },
  assistantRow: {
    gap: 10,
    paddingBottom: 4
  },
  assistantChip: {
    width: 148,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1
  },
  chipTextWrap: {
    flex: 1,
    gap: 2
  },
  chipTitle: {
    fontSize: 13,
    fontWeight: '700'
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
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  confirmBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center'
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700'
  }
})
