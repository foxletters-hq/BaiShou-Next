import React from 'react'
import { View, Text, Pressable, Image } from 'react-native'
import { useTranslation } from 'react-i18next'
import { NOTEBOOK_CARD_ICONS, NOTEBOOK_CARD_TONES } from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Button, SettingsSection, useNativeTheme } from '@baishou/ui/native'
import {
  formatKnowledgeBytesMb,
  NOTEBOOK_TONE_COLORS,
  type KnowledgeNotebookStats
} from './knowledge-screen.util'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'

export function KnowledgeDetailCoverSection(props: {
  name: string
  coverTone: string
  coverIcon: string
  coverImage: string
  coverUri: string | null
  appearance: { tone: string; icon: string }
  stats: KnowledgeNotebookStats | null
  busy: boolean
  modelMismatch: boolean
  onSaveCover: (patch: {
    coverTone?: string | null
    coverIcon?: string | null
    coverImage?: string | null
  }) => void
  onPickCoverImage: () => void
  onRebuildIndex: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const {
    name,
    coverTone,
    coverIcon,
    coverImage,
    coverUri,
    appearance,
    stats,
    busy,
    modelMismatch,
    onSaveCover,
    onPickCoverImage,
    onRebuildIndex,
    onDelete
  } = props
  const coverSize = tokens.spacing.xl + tokens.spacing.lg
  const toneSize = tokens.spacing.lg + tokens.spacing.xs
  const iconSize = tokens.spacing.xl + tokens.spacing.xs

  return (
    <SettingsSection title={t('knowledge.cover_image', '封面图片')}>
      <View style={{ padding: tokens.spacing.md, gap: tokens.spacing.sm }}>
        <View style={[styles.coverRow, { gap: tokens.spacing.sm }]}>
          <View
            style={{
              width: coverSize,
              height: coverSize,
              borderRadius: tokens.radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              backgroundColor: NOTEBOOK_TONE_COLORS[appearance.tone] || colors.primaryLight
            }}
          >
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={styles.coverImage} />
            ) : (
              <Text style={{ fontSize: settingsTypography.pageTitle.fontSize }}>
                {appearance.icon}
              </Text>
            )}
          </View>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: settingsTypography.pageTitle.fontSize,
              fontWeight: settingsTypography.pageTitle.fontWeight,
              flex: 1
            }}
          >
            {name}
          </Text>
        </View>
        {stats ? (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: settingsTypography.desc.fontSize,
              fontWeight: settingsTypography.desc.fontWeight
            }}
          >
            {t('knowledge.storage_usage', '本笔记本 {{total}} MB，其中原文 {{original}} MB', {
              total: formatKnowledgeBytesMb(stats.totalBytes),
              original: formatKnowledgeBytesMb(stats.originalBytes)
            })}
            {stats.pendingJobs > 0
              ? ` · ${t('knowledge.indexing', '索引中')} ${stats.pendingJobs}`
              : ''}
          </Text>
        ) : null}

        <Text
          style={{
            color: colors.textSecondary,
            fontSize: settingsTypography.label.fontSize,
            fontWeight: settingsTypography.label.fontWeight
          }}
        >
          {t('knowledge.cover_tone', '色调')}
        </Text>
        <View style={[styles.chipWrap, { gap: tokens.spacing.sm }]}>
          {NOTEBOOK_CARD_TONES.map((tone) => (
            <Pressable
              key={tone}
              onPress={() => void onSaveCover({ coverTone: tone })}
              style={{
                width: toneSize,
                height: toneSize,
                borderRadius: toneSize / 2,
                borderWidth: 2,
                backgroundColor: NOTEBOOK_TONE_COLORS[tone],
                borderColor: coverTone === tone ? colors.primary : colors.borderMuted
              }}
            />
          ))}
        </View>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: settingsTypography.label.fontSize,
            fontWeight: settingsTypography.label.fontWeight
          }}
        >
          {t('knowledge.cover_icon', '图标')}
        </Text>
        <View style={[styles.chipWrap, { gap: tokens.spacing.sm }]}>
          {NOTEBOOK_CARD_ICONS.map((icon) => (
            <Pressable
              key={icon}
              onPress={() => void onSaveCover({ coverIcon: icon })}
              style={{
                width: iconSize,
                height: iconSize,
                borderRadius: tokens.radius.sm,
                borderWidth: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderColor: coverIcon === icon ? colors.primary : colors.borderMuted,
                backgroundColor: colors.bgSurface
              }}
            >
              <Text>{icon}</Text>
            </Pressable>
          ))}
        </View>
        <View style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
          <Button isDisabled={busy} onPress={() => void onPickCoverImage()}>
            {t('knowledge.upload_cover_image', '上传图片')}
          </Button>
          {coverImage ? (
            <Button
              variant="outlined"
              isDisabled={busy}
              onPress={() => void onSaveCover({ coverImage: '' })}
            >
              {t('knowledge.clear_cover_image', '清除图片')}
            </Button>
          ) : null}
          <Button destructive isDisabled={busy} onPress={onDelete}>
            {t('knowledge.delete_notebook', '删除笔记本')}
          </Button>
        </View>

        {modelMismatch ? (
          <View
            style={{
              borderWidth: 1,
              borderRadius: tokens.radius.sm,
              padding: tokens.spacing.sm,
              gap: tokens.spacing.sm,
              backgroundColor: colors.bgSurface,
              borderColor: colors.error
            }}
          >
            <Text
              style={{
                color: colors.error,
                fontSize: settingsTypography.section.fontSize,
                fontWeight: settingsTypography.section.fontWeight
              }}
            >
              {t('knowledge.model_mismatch_title', '嵌入模型不一致')}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: settingsTypography.desc.fontSize
              }}
            >
              {t(
                'knowledge.model_mismatch_hard_block',
                '提问已硬拦截。请重建索引后再问，否则答案会错得很像样。'
              )}
            </Text>
            <Button isDisabled={busy} onPress={() => void onRebuildIndex()}>
              {t('knowledge.rebuild_index', '重建索引')}
            </Button>
          </View>
        ) : null}
      </View>
    </SettingsSection>
  )
}
