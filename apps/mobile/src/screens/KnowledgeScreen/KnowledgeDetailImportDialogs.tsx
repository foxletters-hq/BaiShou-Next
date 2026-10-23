import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { FileText, Link2, NotebookPen } from 'lucide-react-native'
import { iconSizes, mobileTypography } from '@baishou/ui/theme/tokens'
import { Button, Card, Input, Modal, modalActionsStyle, useNativeTheme } from '@baishou/ui/native'
import type { KnowledgeImportProcessMode } from '@baishou/shared'
import { KnowledgeImportProcessDialog } from './KnowledgeImportProcessDialog'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import type { KnowledgeImportMode } from './knowledge-detail.types'

export function KnowledgeDetailImportDialogs(props: {
  busy: boolean
  importMode: KnowledgeImportMode
  engine?: 'ocr' | 'vision'
  pasteTitle: string
  pasteText: string
  urlValue: string
  importProcessPrompt: {
    fileNames: string[]
    extractEngineLabel: string
    embeddingModelLabel: string
    graphModelLabel: string
    defaultMode: KnowledgeImportProcessMode
  } | null
  onCloseImport: () => void
  onPickImportMode: (mode: Exclude<KnowledgeImportMode, 'chooser' | null>) => void
  onPasteTitleChange: (value: string) => void
  onPasteTextChange: (value: string) => void
  onUrlChange: (value: string) => void
  onImportFile: () => void
  onImportText: () => void
  onImportUrl: () => void
  onSettleImportProcess: (mode: KnowledgeImportProcessMode | null) => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const chooserItems = [
    {
      mode: 'file' as const,
      icon: FileText,
      label: t('knowledge.import_file', '导入文件')
    },
    {
      mode: 'text' as const,
      icon: NotebookPen,
      label: t('knowledge.import_text', '粘贴文本')
    },
    {
      mode: 'url' as const,
      icon: Link2,
      label: t('knowledge.import_url', '导入 URL')
    }
  ]

  return (
    <>
      <Modal
        visible={props.importMode === 'chooser'}
        onClose={props.busy ? undefined : props.onCloseImport}
      >
        <Text
          accessibilityRole="header"
          style={{
            color: colors.textPrimary,
            fontSize: mobileTypography.primary.fontSize,
            fontWeight: mobileTypography.primary.fontWeight,
            marginBottom: tokens.spacing.sm
          }}
        >
          {t('knowledge.add_source', '添加来源')}
        </Text>
        <View style={[styles.chooserGrid, { gap: tokens.spacing.sm }]}>
          {chooserItems.map((item) => {
            const Icon = item.icon
            return (
              <Pressable
                key={item.mode}
                disabled={props.busy}
                onPress={() => {
                  if (item.mode === 'file') {
                    props.onCloseImport()
                    props.onImportFile()
                  } else {
                    props.onPickImportMode(item.mode)
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={styles.chooserItem}
              >
                <Card
                  style={[
                    styles.chooserTile,
                    {
                      gap: tokens.spacing.xs,
                      padding: tokens.spacing.sm
                    }
                  ]}
                >
                  <Icon size={iconSizes.md} color={colors.textPrimary} />
                  <Text
                    numberOfLines={2}
                    style={{
                      color: colors.textPrimary,
                      fontSize: mobileTypography.secondary.fontSize,
                      fontWeight: mobileTypography.secondary.fontWeight,
                      textAlign: 'center'
                    }}
                  >
                    {item.label}
                  </Text>
                </Card>
              </Pressable>
            )
          })}
        </View>
        <View style={modalActionsStyle}>
          <Button
            size="sm"
            variant="outlined"
            isDisabled={props.busy}
            onPress={props.onCloseImport}
          >
            {t('common.cancel', '取消')}
          </Button>
        </View>
      </Modal>

      <Modal
        visible={props.importMode === 'text'}
        title={t('knowledge.import_text', '粘贴文本')}
        onClose={props.busy ? undefined : props.onCloseImport}
      >
        <View style={{ gap: tokens.spacing.sm, width: '100%', alignSelf: 'stretch' }}>
          <Input
            label={t('knowledge.source_title', '标题')}
            value={props.pasteTitle}
            onChangeText={props.onPasteTitleChange}
            containerStyle={styles.importField}
          />
          <Input
            label={t('knowledge.source_body', '正文')}
            value={props.pasteText}
            onChangeText={props.onPasteTextChange}
            textarea
            multiline
            containerStyle={styles.importField}
            style={styles.importBodyInput}
          />
          <View style={modalActionsStyle}>
            <Button
              size="sm"
              variant="outlined"
              isDisabled={props.busy}
              onPress={props.onCloseImport}
            >
              {t('common.cancel', '取消')}
            </Button>
            <Button
              size="sm"
              isDisabled={props.busy || !props.pasteText.trim()}
              onPress={() => void props.onImportText()}
            >
              {t('knowledge.import_submit', '导入')}
            </Button>
          </View>
        </View>
      </Modal>

      <Modal
        visible={props.importMode === 'url'}
        title={t('knowledge.import_url', '导入 URL')}
        onClose={props.busy ? undefined : props.onCloseImport}
      >
        <View style={{ gap: tokens.spacing.sm }}>
          <Input
            label="URL"
            value={props.urlValue}
            onChangeText={props.onUrlChange}
            placeholder="https://"
            autoCapitalize="none"
          />
          <View style={modalActionsStyle}>
            <Button
              size="sm"
              variant="outlined"
              isDisabled={props.busy}
              onPress={props.onCloseImport}
            >
              {t('common.cancel', '取消')}
            </Button>
            <Button
              size="sm"
              isDisabled={props.busy || !props.urlValue.trim()}
              onPress={() => void props.onImportUrl()}
            >
              {t('knowledge.import_submit', '导入')}
            </Button>
          </View>
        </View>
      </Modal>

      <KnowledgeImportProcessDialog
        open={props.importProcessPrompt != null}
        prompt={props.importProcessPrompt}
        onCancel={() => props.onSettleImportProcess(null)}
        onConfirm={(mode) => props.onSettleImportProcess(mode)}
      />
    </>
  )
}
