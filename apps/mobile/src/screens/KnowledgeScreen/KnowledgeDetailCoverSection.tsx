import React from 'react'
import { View, Text, Pressable, Image } from 'react-native'
import { useTranslation } from 'react-i18next'
import { NOTEBOOK_CARD_ICONS, NOTEBOOK_CARD_TONES } from '@baishou/shared'
import { Button, useNativeTheme } from '@baishou/ui/native'
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
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
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
    onRebuildIndex
  } = props

  return (
    <>
      <View style={styles.coverRow}>
        <View
          style={[
            styles.coverPreview,
            { backgroundColor: NOTEBOOK_TONE_COLORS[appearance.tone] || colors.primaryLight }
          ]}
        >
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.coverImage} />
          ) : (
            <Text style={styles.coverEmoji}>{appearance.icon}</Text>
          )}
        </View>
        <Text style={[styles.h1, { color: colors.textPrimary }]}>{name}</Text>
      </View>
      {stats ? (
        <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>
          {t('knowledge.storage_usage', '本笔记本 {{total}} MB，其中原文 {{original}} MB', {
            total: formatKnowledgeBytesMb(stats.totalBytes),
            original: formatKnowledgeBytesMb(stats.originalBytes)
          })}
          {stats.pendingJobs > 0
            ? ` · ${t('knowledge.indexing', '索引中')} ${stats.pendingJobs}`
            : ''}
        </Text>
      ) : null}

      <Text style={[styles.section, { color: colors.textPrimary }]}>
        {t('knowledge.cover_image', '封面图片')}
      </Text>
      <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
        {t('knowledge.cover_tone', '色调')}
      </Text>
      <View style={styles.chipWrap}>
        {NOTEBOOK_CARD_TONES.map((tone) => (
          <Pressable
            key={tone}
            onPress={() => void onSaveCover({ coverTone: tone })}
            style={[
              styles.toneChip,
              {
                backgroundColor: NOTEBOOK_TONE_COLORS[tone],
                borderColor: coverTone === tone ? colors.primary : colors.borderMuted
              }
            ]}
          />
        ))}
      </View>
      <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
        {t('knowledge.cover_icon', '图标')}
      </Text>
      <View style={styles.chipWrap}>
        {NOTEBOOK_CARD_ICONS.map((icon) => (
          <Pressable
            key={icon}
            onPress={() => void onSaveCover({ coverIcon: icon })}
            style={[
              styles.iconChip,
              {
                borderColor: coverIcon === icon ? colors.primary : colors.borderMuted,
                backgroundColor: colors.bgSurface
              }
            ]}
          >
            <Text>{icon}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.rowGap}>
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
      </View>

      {modelMismatch ? (
        <View
          style={[styles.banner, { backgroundColor: colors.bgSurface, borderColor: colors.error }]}
        >
          <Text style={{ color: colors.error, fontWeight: '600' }}>
            {t('knowledge.model_mismatch_title', '嵌入模型不一致')}
          </Text>
          <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
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
    </>
  )
}
