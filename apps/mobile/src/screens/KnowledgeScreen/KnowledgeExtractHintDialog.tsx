import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  isNotebookHeavyConfirmReady,
  notebookHeavyConfirmSecondsLeft,
  type KnowledgeExtractHintChoice,
  type VisionExtractHintReason
} from '@baishou/shared'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import { Button, Modal, modalActionsStyle, useNativeTheme } from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'

export function KnowledgeExtractHintDialog(props: {
  visible: boolean
  fileNames: string[]
  reason: VisionExtractHintReason | null
  visionConfigured: boolean
  visionModelId?: string | null
  busy?: boolean
  onCancel: () => void
  onChoose: (choice: Exclude<KnowledgeExtractHintChoice, 'cancel' | 'keep' | 'ocr'>) => void
  onOpenVisionSettings: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(0)
  const fileNamesKey = props.fileNames.join('\n')

  useEffect(() => {
    if (!props.visible) return
    const start = Date.now()
    setStartedAt(start)
    setNow(start)
    const timer = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(timer)
  }, [props.visible, fileNamesKey])

  const ready = startedAt > 0 && isNotebookHeavyConfirmReady(startedAt, now)
  const secondsLeft = startedAt > 0 ? notebookHeavyConfirmSecondsLeft(startedAt, now) : 3
  const title =
    props.reason === 'garbled-text-layer'
      ? t('knowledge.extract_hint_title_garbled', '文字层已损坏')
      : t('knowledge.extract_hint_title', '几乎没有文字层')
  const body =
    props.reason === 'garbled-text-layer'
      ? t(
          'knowledge.extract_hint_garbled',
          '抽样页的文字层已经损坏，继续按文字层导入容易得到乱码。请选择这次怎么抽出文字。'
        )
      : t(
          'knowledge.extract_hint_empty',
          '抽样页几乎抽不到可用文字，更像扫描件。请选择这次怎么抽出文字。'
        )
  const modelName = props.visionModelId || t('knowledge.extract_hint_vision_model', '视觉模型')
  const hintStyle = {
    color: colors.textSecondary,
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight
  } as const

  return (
    <Modal visible={props.visible} title={title} onClose={props.busy ? undefined : props.onCancel}>
      <Text style={{ ...hintStyle, marginBottom: tokens.spacing.sm }}>{body}</Text>
      {props.fileNames.map((name) => (
        <Text
          key={name}
          numberOfLines={2}
          style={{
            color: colors.textPrimary,
            fontSize: mobileTypography.secondary.fontSize,
            fontWeight: mobileTypography.primary.fontWeight,
            marginBottom: tokens.spacing.xs
          }}
        >
          {name}
        </Text>
      ))}
      {props.visionConfigured ? (
        <Text style={{ ...hintStyle, marginBottom: tokens.spacing.md }}>
          {t('knowledge.extract_hint_vision_ready_mobile', '视觉提取会按页调用 {{model}}。', {
            model: modelName
          })}
        </Text>
      ) : (
        <Text style={{ ...hintStyle, marginBottom: tokens.spacing.md }}>
          {t(
            'knowledge.extract_hint_vision_missing',
            '还没有配置视觉模型。扫描件请先选一个有识图能力的模型。'
          )}
        </Text>
      )}
      <View style={[modalActionsStyle, styles.extractHintActions, { gap: tokens.spacing.sm }]}>
        <Button size="sm" variant="outlined" isDisabled={props.busy} onPress={props.onCancel}>
          {t('common.cancel', '取消')}
        </Button>
        {props.visionConfigured ? (
          <Button
            size="sm"
            isDisabled={!ready || props.busy}
            onPress={() => props.onChoose('vision')}
          >
            {ready
              ? t('knowledge.extract_hint_vision', '使用视觉提取')
              : t('knowledge.extract_hint_vision_wait', '使用视觉提取（{{seconds}}）', {
                  seconds: secondsLeft
                })}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outlined"
            isDisabled={props.busy}
            onPress={() => void props.onOpenVisionSettings()}
          >
            {t('knowledge.extract_hint_open_settings', '去配置视觉模型')}
          </Button>
        )}
      </View>
    </Modal>
  )
}
