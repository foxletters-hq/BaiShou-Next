import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { NotebookCardTone } from '@baishou/shared'
import { NOTEBOOK_CARD_TONES } from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Button, Input, Modal, useNativeTheme } from '@baishou/ui/native'
import { NOTEBOOK_TONE_COLORS } from './knowledge-screen.util'
import { KnowledgeCoverEmojiPicker } from './KnowledgeCoverEmojiPicker'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'

export function KnowledgeCreateNotebookSheet(props: {
  visible: boolean
  busy: boolean
  name: string
  description: string
  tone: NotebookCardTone | ''
  icon: string
  coverName: string
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onToneChange: (tone: NotebookCardTone) => void
  onIconChange: (icon: string) => void
  onPickCoverImage: () => void
  onClearCoverImage: () => void
  onClose: () => void
  onCreate: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const toneSize = tokens.spacing.lg + tokens.spacing.xs

  return (
    <Modal
      visible={props.visible}
      title={t('knowledge.new_notebook', '新建笔记本')}
      onClose={props.busy ? undefined : props.onClose}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={{ gap: tokens.spacing.sm }}>
          <Input
            value={props.name}
            onChangeText={props.onNameChange}
            placeholder={t('knowledge.notebook_name_placeholder', '例如：论文、项目资料')}
          />
          <Input
            value={props.description}
            onChangeText={props.onDescriptionChange}
            placeholder={t('knowledge.notebook_description', '简介，可以留空')}
            textarea
            multiline
          />
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
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: settingsTypography.label.fontSize,
              fontWeight: settingsTypography.label.fontWeight
            }}
          >
            {t('knowledge.cover_icon', '图标')}
          </Text>
          <KnowledgeCoverEmojiPicker
            key={String(props.visible)}
            selected={props.icon}
            disabled={props.busy}
            onSelect={props.onIconChange}
          />
          <View style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
            <Button isDisabled={props.busy} onPress={() => void props.onPickCoverImage()}>
              {t('knowledge.upload_cover_image', '上传图片')}
            </Button>
            {props.coverName ? (
              <Button variant="outlined" isDisabled={props.busy} onPress={props.onClearCoverImage}>
                {t('knowledge.clear_cover_image', '清除图片')}
              </Button>
            ) : null}
          </View>
          {props.coverName ? (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: settingsTypography.desc.fontSize
              }}
            >
              {props.coverName}
            </Text>
          ) : null}
          <View style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
            <Button isDisabled={props.busy} onPress={props.onClose}>
              {t('common.cancel', '取消')}
            </Button>
            <Button
              isDisabled={props.busy || !props.name.trim()}
              onPress={() => void props.onCreate()}
            >
              {t('knowledge.create_action', '创建')}
            </Button>
          </View>
        </View>
      </ScrollView>
    </Modal>
  )
}
