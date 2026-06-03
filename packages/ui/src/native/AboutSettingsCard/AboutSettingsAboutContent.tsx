import React from 'react'
import { View, Text, Pressable, Image, ImageSourcePropType, Linking } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface AboutSettingsAboutContentProps {
  version: string
  heroImageSrc?: string | ImageSourcePropType
  onOpenGithubHost: () => void
  onLogoTap: () => void
  onDevTap: () => void
}

export const AboutSettingsAboutContent: React.FC<AboutSettingsAboutContentProps> = ({
  version,
  heroImageSrc,
  onOpenGithubHost,
  onLogoTap,
  onDevTap
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  const heroSource =
    typeof heroImageSrc === 'string'
      ? { uri: heroImageSrc }
      : heroImageSrc

  return (
    <View
      style={{
        backgroundColor: colors.bgSurface,
        borderRadius: tokens.radius.lg,
        padding: tokens.spacing.lg,
        gap: tokens.spacing.md
      }}
    >
      <Pressable onPress={onLogoTap}>
        <View
          style={{
            width: '100%',
            height: 200,
            backgroundColor: colors.primaryContainer,
            borderRadius: tokens.radius.lg,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
        >
          {heroSource ? (
            <Image source={heroSource} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : null}
        </View>
      </Pressable>

      <View style={{ alignItems: 'center', gap: tokens.spacing.xs }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: '700',
            color: colors.textPrimary
          }}
        >
          {t('about.app_name', '白守 (BaiShou)')}
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: colors.textSecondary
          }}
        >
          {version}
        </Text>
      </View>

      <Pressable onPress={onDevTap}>
        <View
          style={{
            backgroundColor: colors.bgSurfaceNormal,
            borderRadius: tokens.radius.md,
            padding: tokens.spacing.md,
            gap: tokens.spacing.xs
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: colors.textPrimary
            }}
          >
            {t('about.developer_label', '开发者')}
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: colors.textPrimary
            }}
          >
            Anson & Kasumiame Sakura & Tenkou Akatsuki
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary
            }}
          >
            The Trio
          </Text>
        </View>
      </Pressable>

      <Pressable onPress={() => Linking.openURL('https://www.gnu.org/licenses/agpl-3.0.html')}>
        <View
          style={{
            backgroundColor: colors.bgSurfaceNormal,
            borderRadius: tokens.radius.md,
            padding: tokens.spacing.md,
            gap: tokens.spacing.xs
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: colors.textPrimary
            }}
          >
            {t('about.oss_license_label', '开源协议')}
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: colors.textPrimary
            }}
          >
            AGPL v3.0
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary
            }}
          >
            Copyright (C) 2026 Anson, Kasumiame Sakura & Tenkou Akatsuki
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={onOpenGithubHost}
        style={({ pressed }) => ({
          backgroundColor: colors.primary,
          borderRadius: tokens.radius.full,
          paddingVertical: tokens.spacing.md,
          paddingHorizontal: tokens.spacing.lg,
          alignItems: 'center',
          opacity: pressed ? 0.8 : 1
        })}
      >
        <Text
          style={{
            color: colors.onPrimary,
            fontSize: 16,
            fontWeight: '600'
          }}
        >
          {t('about.visit_github', '访问 GitHub 仓库')}
        </Text>
      </Pressable>
    </View>
  )
}
