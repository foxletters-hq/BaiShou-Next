import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { MemoryOnboardingPrimaryKind, MemoryOnboardingStep } from '@baishou/shared'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import { Button, Card, useNativeTheme } from '@baishou/ui/native'

type MemoryOnboardingViewModel = {
  steps: MemoryOnboardingStep[]
  primaryKind: MemoryOnboardingPrimaryKind
}

/**
 * 记忆中心顶部的引导卡片：展示配置/整理步骤，并提供开始与「以后再说」。
 */
export function MemoryCenterOnboardingCard(props: {
  onboarding: MemoryOnboardingViewModel
  onConfigure: () => void
  onStartOrganize: () => void
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  return (
    <Card style={{ marginBottom: tokens.spacing.sm }}>
      <Text style={[styles.onboardingTitle, { color: colors.textPrimary }]}>
        {t('memory.onboarding_title', '开始整理记忆')}
      </Text>
      {props.onboarding.steps.map((step) => (
        <Text
          key={step.id}
          style={{
            color: colors.textSecondary,
            marginTop: tokens.spacing.xs,
            fontSize: mobileTypography.secondary.fontSize,
            fontWeight: mobileTypography.secondary.fontWeight
          }}
        >
          {step.id === 'embed'
            ? t('memory.onboarding_step_embed', '配置嵌入模型')
            : step.id === 'vector'
              ? t('memory.onboarding_step_vector', '索引向量片段')
              : t('memory.onboarding_step_graph', '整理关系图谱')}
          {step.count != null ? ` · ${step.count}` : ''}
        </Text>
      ))}
      <View
        style={[styles.onboardingActions, { gap: tokens.spacing.sm, marginTop: tokens.spacing.md }]}
      >
        <Button
          variant="outlined"
          size="sm"
          onPress={() => {
            if (props.onboarding.primaryKind === 'configure') props.onConfigure()
            else props.onStartOrganize()
          }}
        >
          {props.onboarding.primaryKind === 'configure'
            ? t('memory.go_configure', '去配置')
            : t('memory.onboarding_start', '开始整理记忆')}
        </Button>
        <Button variant="outlined" size="sm" onPress={props.onDismiss}>
          {t('memory.onboarding_dismiss', '以后再说')}
        </Button>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  onboardingTitle: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: mobileTypography.title.fontWeight
  },
  onboardingActions: { flexDirection: 'row', flexWrap: 'wrap' }
})
