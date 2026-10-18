import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react-native'
import {
  knowledgeImportProcessSelectOptions,
  normalizeKnowledgeImportProcessMode,
  type KnowledgeImportProcessMode
} from '@baishou/shared'
import { iconSizes, mobileTypography } from '@baishou/ui/theme/tokens'
import {
  Button,
  Card,
  HelpTooltip,
  Modal,
  Select,
  modalActionsStyle,
  useNativeTheme
} from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'

export type KnowledgeImportProcessPrompt = {
  fileNames: string[]
  extractEngineLabel: string
  embeddingModelLabel: string
  graphModelLabel: string
  defaultMode: KnowledgeImportProcessMode
}

export function KnowledgeImportProcessDialog({
  open,
  prompt,
  onCancel,
  onConfirm
}: {
  open: boolean
  prompt: KnowledgeImportProcessPrompt | null
  onCancel: () => void
  onConfirm: (mode: KnowledgeImportProcessMode) => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [mode, setMode] = useState<KnowledgeImportProcessMode>('both')

  useEffect(() => {
    if (open && prompt) {
      setMode(normalizeKnowledgeImportProcessMode(prompt.defaultMode))
    }
  }, [open, prompt])

  const helpText = [
    t('knowledge.import_process_hint', '会先提取正文，再按选择写入向量、图关系或两者。'),
    t(
      'knowledge.import_process_hint_later',
      '只保存文件，显示为待整理。整理之前 AI 无法使用。之后可在资料上选择嵌入。'
    )
  ].join('\n\n')

  return (
    <Modal
      visible={open}
      title={t('knowledge.import_process_title', '导入后如何处理')}
      onClose={onCancel}
    >
      <View style={{ gap: tokens.spacing.md }}>
        {prompt && prompt.fileNames.length > 0 ? (
          <Card
            style={{
              padding: tokens.spacing.smPlus,
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderControl,
              borderRadius: tokens.radius.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: tokens.spacing.sm
            }}
          >
            <View
              style={{
                padding: tokens.spacing.xsPlus,
                borderRadius: tokens.radius.sm,
                backgroundColor: colors.primaryLight,
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileText size={iconSizes.md} color={colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                ellipsizeMode="middle"
                style={{
                  color: colors.textPrimary,
                  fontSize: mobileTypography.primary.fontSize,
                  fontWeight: mobileTypography.primary.fontWeight
                }}
              >
                {prompt.fileNames.length === 1
                  ? prompt.fileNames[0]
                  : t('knowledge.import_files_count', '共 {{count}} 个文件', {
                      count: prompt.fileNames.length
                    })}
              </Text>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  color: colors.textTertiary,
                  fontSize: mobileTypography.caption.fontSize,
                  marginTop: tokens.spacing.xxs
                }}
              >
                {prompt.fileNames.length === 1
                  ? t('knowledge.import_source_target', '待导入资料')
                  : prompt.fileNames.join('、')}
              </Text>
            </View>
          </Card>
        ) : null}

        <View style={{ gap: tokens.spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: mobileTypography.secondary.fontSize,
                fontWeight: mobileTypography.secondary.fontWeight
              }}
            >
              {t('knowledge.import_process_mode', '本次处理')}
            </Text>
            <HelpTooltip content={helpText} />
          </View>
          <Select
            variant="settings"
            value={mode}
            options={knowledgeImportProcessSelectOptions()}
            onValueChange={(value) => setMode(normalizeKnowledgeImportProcessMode(value))}
          />
        </View>

        <Card
          style={{
            padding: tokens.spacing.smPlus,
            gap: tokens.spacing.xsPlus,
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderControl,
            borderRadius: tokens.radius.md
          }}
        >
          {mode === 'later' ? (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: mobileTypography.secondary.fontSize,
                lineHeight: 20
              }}
            >
              {t(
                'knowledge.import_process_hint_later',
                '只保存文件，显示为待整理。整理之前 AI 无法使用。之后可在资料上选择嵌入。'
              )}
            </Text>
          ) : (
            <>
              <View style={styles.importProcessMetaRow}>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: mobileTypography.secondary.fontSize
                  }}
                >
                  {t('knowledge.import_process_extract', '提取方式')}
                </Text>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={{
                    color: colors.textPrimary,
                    fontSize: mobileTypography.secondary.fontSize,
                    fontWeight: '500',
                    maxWidth: '60%',
                    textAlign: 'right'
                  }}
                >
                  {prompt?.extractEngineLabel || '—'}
                </Text>
              </View>
              <View style={styles.importProcessMetaRow}>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: mobileTypography.secondary.fontSize
                  }}
                >
                  {t('knowledge.import_process_embedding', '嵌入模型')}
                </Text>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="middle"
                  style={{
                    color: colors.textPrimary,
                    fontSize: mobileTypography.secondary.fontSize,
                    fontWeight: '500',
                    maxWidth: '60%',
                    textAlign: 'right'
                  }}
                >
                  {prompt?.embeddingModelLabel || '—'}
                </Text>
              </View>
              {mode === 'both' ? (
                <View style={styles.importProcessMetaRow}>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: mobileTypography.secondary.fontSize
                    }}
                  >
                    {t('knowledge.import_process_graph', '关系抽取模型')}
                  </Text>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="middle"
                    style={{
                      color: colors.textPrimary,
                      fontSize: mobileTypography.secondary.fontSize,
                      fontWeight: '500',
                      maxWidth: '60%',
                      textAlign: 'right'
                    }}
                  >
                    {prompt?.graphModelLabel || '—'}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </Card>

        <View style={modalActionsStyle}>
          <Button size="sm" variant="outlined" onPress={onCancel}>
            {t('common.cancel', '取消')}
          </Button>
          <Button size="sm" onPress={() => onConfirm(mode)}>
            {t('knowledge.import_process_confirm', '确认导入')}
          </Button>
        </View>
      </View>
    </Modal>
  )
}
