import React from 'react'
import { Image, Pressable, ScrollView, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { NotebookCardTone } from '@baishou/shared'
import { NOTEBOOK_CARD_TONES } from '@baishou/shared'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import { Button, Input, Modal, modalActionsStyle, useNativeTheme } from '@baishou/ui/native'
import { NOTEBOOK_TONE_COLORS } from './knowledge-screen.util'
import { KnowledgeCoverEmojiPicker } from './KnowledgeCoverEmojiPicker'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'

export function KnowledgeCreateNotebookSheet(props: {
  visible: boolean
  busy: boolean
  mode: 'create' | 'edit'
  name: string
  description: string
  tone: NotebookCardTone | ''
  icon: string
  coverName: string
  coverUri?: string | null
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onToneChange: (tone: NotebookCardTone) => void
  onIconChange: (icon: string) => void
  onPickCoverImage: () => void
  onClearCoverImage: () => void
  onClose: () => void
  onSubmit: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const toneSize = tokens.spacing.lg + tokens.spacing.xs
  const isEdit = props.mode === 'edit'
  const title = isEdit
    ? t('knowledge.edit_notebook', '修改笔记本')
    : t('knowledge.new_notebook', '新建笔记本')
  const submitLabel = isEdit ? t('common.save', '保存') : t('knowledge.create_action', '创建')

  return (
    <Modal visible={props.visible} title={title} onClose={props.busy ? undefined : props.onClose}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingRight: tokens.spacing.mdTight }}
      >
        <View style={{ gap: tokens.spacing.sm }}>
          <Input
            value={props.name}
            onChangeText={props.onNameChange}
            placeholder={t('knowledge.notebook_name_placeholder', '例如：论文、项目资料')}
          />
          {isEdit ? null : (
            <Input
              value={props.description}
              onChangeText={props.onDescriptionChange}
              placeholder={t('knowledge.notebook_description', '简介，可以留空')}
              textarea
              multiline
            />
          )}
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: mobileTypography.secondary.fontSize,
              fontWeight: mobileTypography.secondary.fontWeight
            }}
          >
            {t('knowledge.cover_tone', '色调')}
          </Text>
          <View style={[styles.chipWrap, { gap: tokens.spacing.sm }]}>
            {NOTEBOOK_CARD_TONES.map((tone) => (
              <Pressable
                key={tone}
                disabled={props.busy}
                onPress={() => props.onToneChange(tone)}
                accessibilityLabel={tone}
                style={{
                  width: toneSize,
                  height: toneSize,
                  borderRadius: toneSize / 2,
                  backgroundColor: NOTEBOOK_TONE_COLORS[tone] || colors.primaryLight,
                  borderWidth: 2,
                  borderColor: props.tone === tone ? colors.primary : colors.borderMuted
                }}
              />
            ))}
          </View>
          <View style={[styles.coverActionsRow, { gap: tokens.spacing.sm }]}>
            <KnowledgeCoverEmojiPicker
              key={String(props.visible)}
              size="sm"
              selected={props.icon}
              disabled={props.busy}
              onSelect={props.onIconChange}
            />
            <Button
              size="sm"
              variant="outlined"
              isDisabled={props.busy}
              onPress={() => void props.onPickCoverImage()}
            >
              {t('knowledge.upload_cover_image', '上传图片')}
            </Button>
          </View>
          {props.coverName || props.coverUri ? (
            <View
              style={[
                styles.coverActionsRow,
                {
                  gap: tokens.spacing.sm,
                  padding: tokens.spacing.xs,
                  borderRadius: tokens.radius.md,
                  borderWidth: 1,
                  borderColor: colors.borderMuted,
                  backgroundColor: colors.bgApp,
                  alignItems: 'center'
                }
              ]}
            >
              {props.coverUri ? (
                <Image
                  source={{ uri: props.coverUri }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: tokens.radius.sm,
                    backgroundColor: colors.bgSurface
                  }}
                  resizeMode="cover"
                />
              ) : null}
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: mobileTypography.secondary.fontSize,
                  flex: 1
                }}
                numberOfLines={1}
              >
                {props.coverName || t('knowledge.cover_image', '封面图片')}
              </Text>
              <Button
                size="sm"
                variant="outlined"
                isDisabled={props.busy}
                onPress={props.onClearCoverImage}
              >
                {t('knowledge.clear_cover_image', '清除图片')}
              </Button>
            </View>
          ) : null}
          <View style={[styles.submitActionsRow, modalActionsStyle]}>
            <Button size="sm" variant="outlined" isDisabled={props.busy} onPress={props.onClose}>
              {t('common.cancel', '取消')}
            </Button>
            <Button
              size="sm"
              isDisabled={props.busy || !props.name.trim()}
              onPress={() => void props.onSubmit()}
            >
              {submitLabel}
            </Button>
          </View>
        </View>
      </ScrollView>
    </Modal>
  )
}
