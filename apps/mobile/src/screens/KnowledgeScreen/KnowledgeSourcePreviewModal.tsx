import React, { useState } from 'react'
import { Linking, ScrollView, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { assessFetchedWebPage, fetchedWebPageIssueMessage } from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Button, MarkdownRenderer, Modal, Select, useNativeTheme } from '@baishou/ui/native'
import type { MobileKnowledgeSourceFilePreview } from '@/src/services/mobile-knowledge-preview.service'
import type { KnowledgeSourceFragment } from './knowledge-source-preview.util'

export function KnowledgeSourcePreviewModal(props: {
  visible: boolean
  title: string
  loading: boolean
  error: string | null
  payload: MobileKnowledgeSourceFilePreview | null
  fragments: KnowledgeSourceFragment[]
  onClose: () => void
  onOpenFile: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const pages = props.payload?.pages?.filter((page) => page.trim()) ?? []
  const [pageIndex, setPageIndex] = useState(0)
  const epubText = pages[pageIndex] || pages[0] || ''
  const text = props.payload?.kind === 'epub' ? epubText : props.payload?.textContent?.trim() || ''
  const canOpenFile = Boolean(props.payload?.localUrl)
  const originUrl = props.payload?.originUrl?.trim() || ''
  const quality =
    originUrl || props.payload?.kind === 'url'
      ? assessFetchedWebPage({
          requestedUrl: originUrl,
          markdown: text
        })
      : null
  const qualityMessage = fetchedWebPageIssueMessage(quality?.issue ?? null)

  return (
    <Modal
      visible={props.visible}
      title={props.title || t('knowledge.source_preview', '原文预览')}
      onClose={props.onClose}
    >
      {props.loading ? (
        <Text style={{ color: colors.textSecondary }}>{t('common.loading', '加载中…')}</Text>
      ) : null}
      {props.error ? (
        <Text style={{ color: colors.error, marginBottom: tokens.spacing.sm }}>{props.error}</Text>
      ) : null}
      {originUrl ? (
        <View style={{ marginBottom: tokens.spacing.sm }}>
          <Button
            variant="outlined"
            onPress={() => {
              void Linking.openURL(originUrl)
            }}
          >
            {t('knowledge.open_origin_url', '打开原网址')}
          </Button>
        </View>
      ) : null}
      {props.payload?.kind === 'epub' && pages.length > 1 ? (
        <Select
          value={String(Math.min(pageIndex, pages.length - 1))}
          onValueChange={(value) => setPageIndex(Number(value))}
          options={pages.map((_, index) => ({
            value: String(index),
            label: t('knowledge.epub_chapter', '第 {{page}} 章', { page: index + 1 })
          }))}
        />
      ) : null}
      {qualityMessage ? (
        <Text style={{ color: colors.error, marginBottom: tokens.spacing.sm }}>
          {qualityMessage}
        </Text>
      ) : null}
      <ScrollView style={{ maxHeight: tokens.spacing.xl * 10 }}>
        {props.fragments.map((item) => (
          <View key={item.id} style={{ marginBottom: tokens.spacing.sm, gap: tokens.spacing.xs }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: settingsTypography.row.fontSize,
                fontWeight: settingsTypography.row.fontWeight
              }}
            >
              {item.sourceTitle} · #{item.index + 1}
            </Text>
            {item.excerpts.map((excerpt) => (
              <MarkdownRenderer key={excerpt} content={excerpt} variant="preview" />
            ))}
            <MarkdownRenderer
              content={item.text || t('knowledge.extracted_empty', '还没有抽出正文')}
              variant="preview"
            />
          </View>
        ))}
        {text ? (
          <MarkdownRenderer content={text} variant="preview" />
        ) : props.payload && !props.fragments.length ? (
          <Text style={{ color: colors.textSecondary }}>
            {props.payload.kind === 'pdf'
              ? t('knowledge.pdf_open_in_system', 'PDF 请用系统应用打开。')
              : t('knowledge.extracted_empty', '还没有抽出正文')}
          </Text>
        ) : null}
      </ScrollView>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: tokens.spacing.sm,
          marginTop: tokens.spacing.md
        }}
      >
        {canOpenFile ? (
          <Button onPress={() => void props.onOpenFile()}>
            {t('knowledge.open_source_file', '用系统应用打开')}
          </Button>
        ) : null}
        <Button onPress={props.onClose}>{t('common.got_it', '知道了')}</Button>
      </View>
    </Modal>
  )
}
