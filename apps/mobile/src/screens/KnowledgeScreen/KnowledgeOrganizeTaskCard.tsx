import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import { Button, Card, modalActionsStyle, useNativeTheme } from '@baishou/ui/native'
import type { KnowledgeOrganizeTaskAction } from './knowledge-organize-banner.util'

export function KnowledgeOrganizeTaskActions(props: {
  actions: KnowledgeOrganizeTaskAction[]
  busy?: boolean
  onRestart: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  if (props.actions.length === 0) return null
  return (
    <View style={[modalActionsStyle, { marginTop: 0 }]}>
      {props.actions.includes('restart') ? (
        <Button variant="outlined" size="sm" disabled={props.busy} onPress={props.onRestart}>
          {t('knowledge.organize_restart', '重新开始')}
        </Button>
      ) : null}
      {props.actions.includes('cancel') ? (
        <Button variant="outlined" size="sm" disabled={props.busy} onPress={props.onCancel}>
          {t('knowledge.organize_cancel', '取消')}
        </Button>
      ) : null}
    </View>
  )
}

export function KnowledgeOrganizeTaskCard(props: {
  title: string
  phaseLabel: string
  phaseValue: string
  error?: string
  busy?: boolean
  actions: KnowledgeOrganizeTaskAction[]
  onRestart: () => void
  onCancel: () => void
}) {
  const { colors, tokens } = useNativeTheme()

  return (
    <Card style={{ padding: tokens.spacing.sm, borderRadius: tokens.radius.md }}>
      <View style={{ gap: tokens.spacing.xs }}>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: mobileTypography.secondary.fontSize,
            fontWeight: mobileTypography.secondary.fontWeight
          }}
          numberOfLines={2}
        >
          {props.title}
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: mobileTypography.secondary.fontSize
          }}
          numberOfLines={1}
        >
          {props.phaseLabel} {props.phaseValue}
        </Text>
        {props.error ? (
          <Text
            style={{
              color: colors.error,
              fontSize: mobileTypography.secondary.fontSize
            }}
            numberOfLines={2}
          >
            {props.error}
          </Text>
        ) : null}
        <KnowledgeOrganizeTaskActions
          actions={props.actions}
          busy={props.busy}
          onRestart={props.onRestart}
          onCancel={props.onCancel}
        />
      </View>
    </Card>
  )
}
