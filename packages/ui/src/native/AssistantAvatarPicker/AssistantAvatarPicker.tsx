import React, { useCallback, useState } from 'react'
import { View, Text, Image, Pressable, StyleSheet, ScrollView } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import {
  BUILTIN_ASSISTANT_AVATAR_IDS,
  type BuiltinAssistantAvatarId,
  isAssistantCustomAvatar,
  parseBuiltinAssistantAvatarId,
  toBuiltinAssistantAvatarPath
} from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { Modal } from '../Modal'
import { NATIVE_BUILTIN_ASSISTANT_AVATAR_SOURCES } from '../builtin-assistant-avatar.sources'
import { resolveNativeAssistantAvatarSource } from '../assistant-avatar.util'

export interface AssistantAvatarPickerProps {
  avatarPath?: string | null
  previewUri?: string | null
  onSelectBuiltin: (path: string) => void
  onPressUpload: () => void
  previewSize?: number
}

export const AssistantAvatarPicker: React.FC<AssistantAvatarPickerProps> = ({
  avatarPath,
  previewUri,
  onSelectBuiltin,
  onPressUpload,
  previewSize = 88
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [choiceModalOpen, setChoiceModalOpen] = useState(false)
  const [builtinModalOpen, setBuiltinModalOpen] = useState(false)

  const selectedBuiltinId = parseBuiltinAssistantAvatarId(avatarPath)
  const previewSource = previewUri
    ? { uri: previewUri }
    : resolveNativeAssistantAvatarSource(avatarPath, previewUri)
  const previewRadius = previewSize / 2

  const handleSelect = useCallback(
    (id: BuiltinAssistantAvatarId) => {
      onSelectBuiltin(toBuiltinAssistantAvatarPath(id))
      setBuiltinModalOpen(false)
    },
    [onSelectBuiltin]
  )

  const handleUpload = () => {
    setChoiceModalOpen(false)
    onPressUpload()
  }

  const openBuiltinPicker = () => {
    setChoiceModalOpen(false)
    setBuiltinModalOpen(true)
  }

  return (
    <View style={styles.root}>
      <Pressable
        onPress={() => setChoiceModalOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('common.edit_avatar', '点击修改头像')}
        style={[
          styles.previewShell,
          {
            width: previewSize,
            height: previewSize,
            borderRadius: previewRadius,
            borderColor: colors.borderMuted
          }
        ]}
      >
        <Image source={previewSource} style={styles.preview} resizeMode="cover" />
      </Pressable>

      <Modal
        visible={choiceModalOpen}
        title={t('agent.assistant.avatar_choice_title', '选择头像')}
        onClose={() => setChoiceModalOpen(false)}
      >
        <View style={styles.actionRow}>
          <Pressable
            onPress={openBuiltinPicker}
            style={[
              styles.actionBtn,
              {
                borderColor: colors.borderMuted,
                borderRadius: tokens.radius.lg,
                backgroundColor: colors.bgSurfaceNormal
              }
            ]}
          >
            <MaterialIcons name="grid-view" size={17} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.textPrimary }]} numberOfLines={1}>
              {t('agent.assistant.select_builtin_avatar', '选择内置头像')}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleUpload}
            style={[
              styles.actionBtn,
              {
                borderColor: colors.borderMuted,
                borderRadius: tokens.radius.lg,
                backgroundColor: colors.bgSurfaceNormal
              }
            ]}
          >
            <MaterialIcons name="add-photo-alternate" size={17} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.textPrimary }]} numberOfLines={1}>
              {t('agent.assistant.upload_avatar', '从本地上传')}
            </Text>
          </Pressable>
        </View>
      </Modal>

      <Modal
        visible={builtinModalOpen}
        title={t('agent.assistant.builtin_avatars', '内置头像')}
        onClose={() => setBuiltinModalOpen(false)}
      >
        <ScrollView contentContainerStyle={styles.modalGrid} showsVerticalScrollIndicator={false}>
          {BUILTIN_ASSISTANT_AVATAR_IDS.map((id) => {
            const selected =
              selectedBuiltinId === id && !isAssistantCustomAvatar(avatarPath) && !previewUri
            return (
              <Pressable
                key={id}
                onPress={() => handleSelect(id)}
                style={[
                  styles.presetBtn,
                  {
                    borderColor: selected ? colors.primary : colors.borderSubtle,
                    borderRadius: tokens.radius.md,
                    backgroundColor: colors.bgSurface
                  },
                  selected && { borderWidth: 2 }
                ]}
              >
                <Image
                  source={NATIVE_BUILTIN_ASSISTANT_AVATAR_SOURCES[id]}
                  style={styles.presetImg}
                />
              </Pressable>
            )
          })}
        </ScrollView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    width: '100%'
  },
  previewShell: {
    borderWidth: 2,
    overflow: 'hidden'
  },
  preview: {
    width: '100%',
    height: '100%'
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    width: '100%'
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 0
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1
  },
  modalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingBottom: 4
  },
  presetBtn: {
    width: 72,
    height: 72,
    borderWidth: 1,
    overflow: 'hidden'
  },
  presetImg: {
    width: '100%',
    height: '100%'
  }
})
