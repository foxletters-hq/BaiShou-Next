import React from 'react'
import { ScrollView, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { AgentMarkdownRenderer } from '../AgentMarkdown'
import { Modal } from '../Modal'
import { useNativeTheme } from '../theme'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export function SkillCitePreviewDialog(props: {
  visible: boolean
  command: string
  content: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const command = props.command.replace(/^\//, '').trim()
  const body = props.content.trim()

  return (
    <Modal
      visible={props.visible}
      title={t('shortcut.view_skill', '查看 Skill')}
      onClose={props.onClose}
    >
      {command ? (
        <Text
          style={{
            color: colors.primary,
            fontSize: mobileTypography.body.fontSize,
            fontWeight: '500',
            marginBottom: sharedTokens.spacing.sm
          }}
        >
          /{command}
        </Text>
      ) : null}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingRight: sharedTokens.spacing.mdTight }}
      >
        {body ? (
          <AgentMarkdownRenderer content={body} />
        ) : (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: mobileTypography.body.fontSize,
              lineHeight: mobileTypography.body.lineHeight
            }}
          >
            {t('shortcut.skill_content_empty', '该 Skill 暂无正文内容')}
          </Text>
        )}
      </ScrollView>
    </Modal>
  )
}
