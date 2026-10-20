import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import { Button, useNativeTheme } from '@baishou/ui/native'

/** 嵌入模型与现有索引不一致时的硬拦截提示。 */
export function KnowledgeDetailModelMismatchBanner(props: {
  busy: boolean
  onRebuild: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  return (
    <View
      style={{
        marginHorizontal: tokens.spacing.md,
        marginBottom: tokens.spacing.sm,
        padding: tokens.spacing.sm,
        gap: tokens.spacing.sm,
        borderWidth: 1,
        borderRadius: tokens.radius.xs,
        borderColor: colors.error,
        backgroundColor: colors.bgSurface
      }}
    >
      <Text
        style={{
          color: colors.error,
          fontSize: mobileTypography.primary.fontSize,
          fontWeight: mobileTypography.primary.fontWeight
        }}
      >
        {t('knowledge.model_mismatch_title', '嵌入模型不一致')}
      </Text>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: mobileTypography.secondary.fontSize
        }}
      >
        {t(
          'knowledge.model_mismatch_hard_block',
          '提问已硬拦截。请重建索引后再问，否则答案会错得很像样。'
        )}
      </Text>
      <Button size="sm" isDisabled={props.busy} onPress={props.onRebuild}>
        {t('knowledge.rebuild_index', '重建索引')}
      </Button>
    </View>
  )
}
