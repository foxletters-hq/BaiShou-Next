import React from 'react'
import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button, Input } from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'

export function KnowledgeDetailImportSection(props: {
  busy: boolean
  showImport: 'text' | 'url' | null
  pasteTitle: string
  pasteText: string
  urlValue: string
  onShowImport: (mode: 'text' | 'url') => void
  onPasteTitle: (v: string) => void
  onPasteText: (v: string) => void
  onUrlValue: (v: string) => void
  onImportText: () => void
  onImportUrl: () => void
}) {
  const { t } = useTranslation()
  const {
    busy,
    showImport,
    pasteTitle,
    pasteText,
    urlValue,
    onShowImport,
    onPasteTitle,
    onPasteText,
    onUrlValue,
    onImportText,
    onImportUrl
  } = props

  return (
    <>
      <View style={styles.rowGap}>
        <Button isDisabled={busy} onPress={() => onShowImport('text')}>
          {t('knowledge.import_text', '粘贴文本')}
        </Button>
        <Button isDisabled={busy} onPress={() => onShowImport('url')}>
          {t('knowledge.import_url', '导入 URL')}
        </Button>
      </View>

      {showImport === 'text' ? (
        <View style={{ marginBottom: 16 }}>
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
            containerStyle={{ marginTop: 8, marginBottom: 10 }}
          />
          <Button isDisabled={busy || !pasteText.trim()} onPress={() => void onImportText()}>
            {t('knowledge.import_submit', '导入')}
          </Button>
        </View>
      ) : null}

      {showImport === 'url' ? (
        <View style={{ marginBottom: 16 }}>
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
    </>
  )
}
