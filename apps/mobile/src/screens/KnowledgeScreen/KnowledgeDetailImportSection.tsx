import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  knowledgeImportProcessSelectOptions,
  type KnowledgeImportProcessMode
} from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Button, Input, Select, SettingsSection, useNativeTheme } from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'

export function KnowledgeDetailImportSection(props: {
  busy: boolean
  showImport: 'text' | 'url' | null
  pasteTitle: string
  pasteText: string
  urlValue: string
  importProcessMode: KnowledgeImportProcessMode
  onShowImport: (mode: 'text' | 'url') => void
  onPasteTitle: (v: string) => void
  onPasteText: (v: string) => void
  onUrlValue: (v: string) => void
  onImportProcessMode: (mode: KnowledgeImportProcessMode) => void
  onImportText: () => void
  onImportUrl: () => void
  onImportFile: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const {
    busy,
    showImport,
    pasteTitle,
    pasteText,
    urlValue,
    importProcessMode,
    onShowImport,
    onPasteTitle,
    onPasteText,
    onUrlValue,
    onImportProcessMode,
    onImportText,
    onImportUrl,
    onImportFile
  } = props

  return (
    <SettingsSection title={t('knowledge.import_file', '导入文件')}>
      <View style={{ padding: tokens.spacing.md, gap: tokens.spacing.sm }}>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: settingsTypography.label.fontSize,
            fontWeight: settingsTypography.label.fontWeight
          }}
        >
          {t('knowledge.import_process_mode', '本次处理')}
        </Text>
        <Select
          value={importProcessMode}
          options={knowledgeImportProcessSelectOptions()}
          onValueChange={(value) => onImportProcessMode(value as KnowledgeImportProcessMode)}
        />
        <View style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
          <Button isDisabled={busy} onPress={() => void onImportFile()}>
            {t('knowledge.import_file', '导入文件')}
          </Button>
          <Button isDisabled={busy} onPress={() => onShowImport('text')}>
            {t('knowledge.import_text', '粘贴文本')}
          </Button>
          <Button isDisabled={busy} onPress={() => onShowImport('url')}>
            {t('knowledge.import_url', '导入 URL')}
          </Button>
        </View>

        {showImport === 'text' ? (
          <View style={{ gap: tokens.spacing.sm }}>
            <Input
              value={pasteTitle}
              onChangeText={onPasteTitle}
              placeholder={t('knowledge.source_title', '标题')}
            />
            <Input
              value={pasteText}
              onChangeText={onPasteText}
              placeholder={t('knowledge.source_body', '正文')}
              textarea
              multiline
            />
            <Button isDisabled={busy || !pasteText.trim()} onPress={() => void onImportText()}>
              {t('knowledge.import_submit', '导入')}
            </Button>
          </View>
        ) : null}

        {showImport === 'url' ? (
          <View style={{ gap: tokens.spacing.sm }}>
            <Input
              value={urlValue}
              onChangeText={onUrlValue}
              placeholder="https://"
              autoCapitalize="none"
            />
            <Button isDisabled={busy || !urlValue.trim()} onPress={() => void onImportUrl()}>
              {t('knowledge.import_submit', '导入')}
            </Button>
          </View>
        ) : null}
      </View>
    </SettingsSection>
  )
}
