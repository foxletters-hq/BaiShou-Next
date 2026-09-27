import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  isNotebookHeavyConfirmReady,
  notebookHeavyConfirmSecondsLeft,
  type KnowledgeExtractHintChoice,
  type VisionExtractHintReason
} from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Button, Modal, useNativeTheme } from '@baishou/ui/native'

export function KnowledgeExtractHintDialog(props: {
  visible: boolean
  fileNames: string[]
  reason: VisionExtractHintReason | null
  visionConfigured: boolean
  visionModelId?: string | null
  busy?: boolean
  onCancel: () => void
  onChoose: (choice: Exclude<KnowledgeExtractHintChoice, 'cancel'>) => void
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

  return (
    <Modal visible={props.visible} title={title} onClose={props.busy ? undefined : props.onCancel}>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: settingsTypography.desc.fontSize,
          fontWeight: settingsTypography.desc.fontWeight,
          marginBottom: tokens.spacing.sm
        }}
      >
        {body}
      </Text>
      {props.fileNames.map((name) => (
        <Text
          key={name}
          style={{
            color: colors.textPrimary,
            fontSize: settingsTypography.row.fontSize,
            marginBottom: tokens.spacing.xs
          }}
        >
          {name}
        </Text>
      ))}
      {props.visionConfigured ? (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: settingsTypography.desc.fontSize,
            marginBottom: tokens.spacing.md
          }}
        >
          {t(
            'knowledge.extract_hint_vision_ready',
            '视觉提取会按页调用 {{model}}；本地 OCR 在本机识别，不调用模型。',
            { model: modelName }
          )}
        </Text>
      ) : (
        <View style={{ marginBottom: tokens.spacing.md, gap: tokens.spacing.sm }}>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: settingsTypography.desc.fontSize
            }}
          >
            {t(
              'knowledge.extract_hint_vision_missing',
              '还没有配置视觉模型。可以先设好再抽，或继续用本地 OCR。'
            )}
          </Text>
          <Button isDisabled={props.busy} onPress={() => void props.onOpenVisionSettings()}>
            {t('knowledge.vision_model', '视觉模型')}
          </Button>
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm }}>
        <Button isDisabled={props.busy} onPress={props.onCancel}>
          {t('common.cancel', '取消')}
        </Button>
        <Button isDisabled={!ready || props.busy} onPress={() => props.onChoose('ocr')}>
          {ready
            ? t('knowledge.engine_ocr', '本地 OCR')
            : t('knowledge.heavy_confirm_button', '确认（{{seconds}}）', { seconds: secondsLeft })}
        </Button>
        <Button
          isDisabled={!ready || props.busy || !props.visionConfigured}
          onPress={() => props.onChoose('vision')}
        >
          {t('knowledge.engine_vision', '视觉模型')}
        </Button>
        <Button
          variant="outlined"
          isDisabled={!ready || props.busy}
          onPress={() => props.onChoose('keep')}
        >
          {t('knowledge.extract_hint_keep', '按当前方式')}
        </Button>
      </View>
    </Modal>
  )
}
