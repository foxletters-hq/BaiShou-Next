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
import { useDialog } from '../Dialog'
import { Modal } from '../Modal'
import { NATIVE_BUILTIN_ASSISTANT_AVATAR_SOURCES } from '../builtin-assistant-avatar.sources'
import { resolveNativeAssistantAvatarSource } from '../assistant-avatar.util'
import { runAfterOverlayDismiss } from '../avatar-image-picker.util'

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
  const dialog = useDialog()
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

  const openAvatarChoice = useCallback(async () => {
    const choice = await dialog.choose(
      t('agent.assistant.avatar_choice_title', '选择头像'),
      [
        {
          label: t('agent.assistant.select_builtin_avatar', '选择内置头像'),
          value: 'builtin',
          leading: <MaterialIcons name="grid-view" size={20} color={colors.primary} />
        },
        {
          label: t('agent.assistant.upload_avatar', '从本地上传'),
          value: 'upload',
          leading: <MaterialIcons name="add-photo-alternate" size={20} color={colors.primary} />
        }
      ]
    )

    if (choice === 'builtin') {
      runAfterOverlayDismiss(() => setBuiltinModalOpen(true))
    } else if (choice === 'upload') {
      runAfterOverlayDismiss(onPressUpload)
    }
  }, [colors.primary, dialog, onPressUpload, t])

  return (
    <View style={styles.root}>
      <Pressable
        onPress={() => void openAvatarChoice()}
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
