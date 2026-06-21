import React, { useState } from 'react'
import { View, Text, Pressable, Image } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { useDialog } from '../Dialog'
import { useNativeToast } from '../Toast'
import { resolveNativeUserAvatarSource } from '../user-avatar.util'
import {
  launchAvatarImageLibraryAsync,
  requestAvatarLibraryPermission,
  runAfterOverlayDismiss
} from '../avatar-image-picker.util'

export interface ProfileData {
  nickname: string
  avatarPath?: string | null
}

export interface NativeProfileSettingsCardProps {
  profile: ProfileData
  onSave: (data: ProfileData) => void
}

export const ProfileSettingsCard: React.FC<NativeProfileSettingsCardProps> = ({
  profile,
  onSave
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const dialog = useDialog()
  const toast = useNativeToast()

  const pickAvatarFromLibrary = async () => {
    try {
      if (!(await requestAvatarLibraryPermission())) {
        toast.showError(t('profile.image_pick_permission', '需要相册权限才能选择图片'))
        return
      }

      const result = await launchAvatarImageLibraryAsync()
      if (!result.canceled && result.assets[0]) {
        onSave({ ...profile, avatarPath: result.assets[0].uri })
      }
    } catch {
      toast.showError(t('profile.image_pick_error', '选择图片失败'))
    }
  }

  const handlePickImage = () => {
    void dialog
      .choose(t('profile.change_avatar', '更换头像'), [
        {
          label: t('profile.pick_from_library', '从相册选择'),
          value: 'library'
        }
      ])
      .then((choice) => {
        if (choice === 'library') {
          runAfterOverlayDismiss(() => void pickAvatarFromLibrary())
        }
      })
  }

  const handleEditNickname = async () => {
    const promptMessage = t('profile.edit_nickname_prompt', '请输入新的昵称：')
    const nextName = await dialog.prompt(promptMessage, profile.nickname)
    if (nextName && nextName.trim() !== '' && nextName !== profile.nickname) {
      onSave({ ...profile, nickname: nextName.trim() })
    }
  }

  return (
    <View
      style={{
        backgroundColor: colors.bgSurface,
        borderRadius: tokens.radius.lg,
        padding: tokens.spacing.lg,
        alignItems: 'center',
        gap: tokens.spacing.md
      }}
    >
      {/* 头像区域 */}
      <Pressable
        onPress={handlePickImage}
        style={({ pressed }) => ({
          opacity: pressed ? 0.8 : 1
        })}
      >
        <View
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: colors.primaryContainer,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
        >
          <Image
            source={resolveNativeUserAvatarSource(profile.avatarPath)}
            style={{ width: 100, height: 100 }}
            resizeMode="cover"
          />
        </View>
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Text style={{ fontSize: 16 }}>📷</Text>
        </View>
      </Pressable>

      {/* 昵称区域 */}
      <View style={{ alignItems: 'center', gap: tokens.spacing.sm }}>
        <Text
          style={{
            fontSize: 20,
            fontWeight: '600',
            color: colors.textPrimary
          }}
        >
          {profile.nickname || t('profile.default_nickname', '白守用户')}
        </Text>

        <Pressable
          onPress={handleEditNickname}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            paddingHorizontal: tokens.spacing.md,
            paddingVertical: tokens.spacing.xs,
            borderRadius: tokens.radius.full,
            backgroundColor: colors.bgSurfaceNormal
          })}
        >
          <Text
            style={{
              fontSize: 14,
              color: colors.primary
            }}
          >
            ✎ {t('profile.edit_nickname', '修改昵称')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
