import React from 'react'
import { View, Text, Pressable, Image, StyleSheet, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MaterialIcons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useNativeTheme, useDialog } from '@baishou/ui/native'

export interface SettingsProfileHeaderProps {
  profile: { nickname: string; avatarPath?: string | null }
  onSave: (data: { nickname: string; avatarPath?: string | null }) => void
  /** 数据库未就绪时仍可展示，仅禁用保存 */
  disabled?: boolean
}

export const SettingsProfileHeader: React.FC<SettingsProfileHeaderProps> = ({
  profile,
  onSave,
  disabled = false
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const dialog = useDialog()

  const displayName = profile.nickname?.trim() || t('profile.default_nickname', '白守用户')
  const initial = (profile.nickname || t('profile.defaultChar', '白')).charAt(0).toUpperCase()

  const handlePickImage = async () => {
    if (disabled) return
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8
      })
      if (!result.canceled && result.assets[0]) {
        onSave({ ...profile, avatarPath: result.assets[0].uri })
      }
    } catch {
      Alert.alert(t('common.error', '错误'), t('profile.image_pick_error', '选择图片失败'))
    }
  }

  const handleEditNickname = async () => {
    if (disabled) return
    const nextName = await dialog.prompt(
      t('profile.edit_nickname_prompt', '请输入新的昵称：'),
      profile.nickname
    )
    if (nextName && nextName.trim() !== '' && nextName !== profile.nickname) {
      onSave({ ...profile, nickname: nextName.trim() })
    }
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.bgSurface,
          borderRadius: tokens.radius.lg
        }
      ]}
    >
      <Pressable
        onPress={handlePickImage}
        disabled={disabled}
        style={({ pressed }) => [styles.avatarBtn, pressed && !disabled && { opacity: 0.85 }]}
      >
        <View
          style={[
            styles.avatar,
            { backgroundColor: colors.primaryContainer }
          ]}
        >
          {profile.avatarPath ? (
            <Image source={{ uri: profile.avatarPath }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.avatarLetter, { color: colors.onPrimaryContainer }]}>
              {initial}
            </Text>
          )}
        </View>
        <View style={[styles.cameraBadge, { backgroundColor: colors.primary }]}>
          <MaterialIcons name="photo-camera" size={14} color={colors.textOnPrimary} />
        </View>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.meta, pressed && !disabled && { opacity: 0.75 }]}
        onPress={handleEditNickname}
        disabled={disabled}
      >
        <Text style={[styles.nickname, { color: colors.textPrimary }]} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {t('settings.tap_avatar_to_change', '点击头像更换图片')}
          {' · '}
          {t('profile.edit_nickname', '修改昵称')}
        </Text>
      </Pressable>

      <MaterialIcons name="chevron-right" size={22} color={colors.textTertiary} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14
  },
  avatarBtn: {
    position: 'relative'
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  avatarImage: {
    width: 72,
    height: 72
  },
  avatarLetter: {
    fontSize: 28,
    fontWeight: '600'
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center'
  },
  meta: {
    flex: 1,
    gap: 4
  },
  nickname: {
    fontSize: 20,
    fontWeight: '600'
  },
  hint: {
    fontSize: 13
  }
})
