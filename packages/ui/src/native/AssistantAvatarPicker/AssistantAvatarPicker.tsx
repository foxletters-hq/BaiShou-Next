import React, { useCallback } from 'react'
import { View, Text, Image, Pressable, StyleSheet } from 'react-native'
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
import { NATIVE_BUILTIN_ASSISTANT_AVATAR_SOURCES } from '../builtin-assistant-avatar.sources'
import { resolveNativeAssistantAvatarSource } from '../assistant-avatar.util'

export interface AssistantAvatarPickerProps {
  avatarPath?: string | null
  previewUri?: string | null
  onSelectBuiltin: (path: string) => void
  onPressUpload: () => void
}

export const AssistantAvatarPicker: React.FC<AssistantAvatarPickerProps> = ({
  avatarPath,
  previewUri,
  onSelectBuiltin,
  onPressUpload
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  const selectedBuiltinId = parseBuiltinAssistantAvatarId(avatarPath)
  const previewSource = previewUri
    ? { uri: previewUri }
    : resolveNativeAssistantAvatarSource(avatarPath, previewUri)

  const handleSelect = useCallback(
    (id: BuiltinAssistantAvatarId) => {
      onSelectBuiltin(toBuiltinAssistantAvatarPath(id))
    },
    [onSelectBuiltin]
  )

  return (
    <View style={styles.root}>
      <View style={[styles.previewShell, { borderColor: colors.borderMuted }]}>
        <Image source={previewSource} style={styles.preview} resizeMode="cover" />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        {t('agent.assistant.builtin_avatars', '内置头像')}
      </Text>

      <View style={styles.presetRow}>
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
      </View>

      <Pressable
        onPress={onPressUpload}
        style={[
          styles.uploadLink,
          { borderColor: colors.borderMuted, borderRadius: tokens.radius.lg }
        ]}
      >
        <MaterialIcons name="photo-library" size={18} color={colors.primary} />
        <Text style={[styles.uploadLinkText, { color: colors.textPrimary }]}>
          {t('agent.assistant.upload_avatar', '从本地上传')}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    width: '100%',
    gap: 14
  },
  previewShell: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    overflow: 'hidden'
  },
  preview: {
    width: '100%',
    height: '100%'
  },
  sectionLabel: {
    alignSelf: 'flex-start',
    fontSize: 13,
    fontWeight: '500'
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
    justifyContent: 'space-between'
  },
  presetBtn: {
    width: '18%',
    minWidth: 56,
    aspectRatio: 1,
    borderWidth: 1,
    overflow: 'hidden'
  },
  presetImg: {
    width: '100%',
    height: '100%'
  },
  uploadLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth
  },
  uploadLinkText: {
    fontSize: 14,
    fontWeight: '500'
  }
})
