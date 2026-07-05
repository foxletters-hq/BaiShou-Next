import React from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { AgentMarkdownRenderer } from '../AgentMarkdown'
import { ThinkingBlock } from '../ThinkingBlock'
import { getLabelBadgeColor } from './context-chain-dialog.utils'
import { COMPRESSION_SUMMARY_SELECTION_KEY, type useContextChainView } from './useContextChainView'
import { ContextChainRecompressBar } from './ContextChainRecompressBar'
import { ContextChainRecompressProgress } from './ContextChainRecompressProgress'
import { CompressionActivityBar } from '../CompressionActivityBar'

type ContextChainView = ReturnType<typeof useContextChainView>

interface ContextChainDetailPageProps {
  view: ContextChainView
  detailKey: string
  onBack: () => void
  onClose: () => void
  sessionId?: string
  recompressBusy?: boolean
  recompressStartedAt?: number
  recompressStreamText?: string
  recompressStreamReasoning?: string
  recompressError?: string | null
  onRecompress?: () => void
  onRecompressDismissError?: () => void
}

export const ContextChainDetailPage: React.FC<ContextChainDetailPageProps> = ({
  view,
  detailKey,
  onBack,
  onClose,
  sessionId,
  recompressBusy = false,
  recompressStartedAt,
  recompressStreamText = '',
  recompressStreamReasoning = '',
  recompressError = null,
  onRecompress,
  onRecompressDismissError
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  const isCompression = detailKey === COMPRESSION_SUMMARY_SELECTION_KEY
  const systemPromptId = view.systemPromptEntry?.item?.id
  const isSystemPrompt = Boolean(systemPromptId && detailKey === systemPromptId)

  const selectedEntry = view.flatEntries.find(
    (e) => (e.kind === 'message' || e.kind === 'system-prompt') && e.item?.id === detailKey
  )
  const selected = selectedEntry?.item

  const label = isCompression
    ? t('agent.chat.compaction_summary', '对话压缩')
    : selected
      ? view.getMessageLabel(selected)
      : t('agent.chat.full_call_chain', '完整调用链')

  const badgeColor = getLabelBadgeColor(label, colors)

  const renderBody = () => {
    if (isCompression) {
      return (
        <>
          {sessionId && onRecompress ? (
            <ContextChainRecompressBar
              busy={recompressBusy}
              error={recompressError}
              onRecompress={onRecompress}
              onDismissError={onRecompressDismissError}
            />
          ) : null}
          {recompressBusy ? (
            <>
              <ContextChainRecompressProgress startedAt={recompressStartedAt} />
              <CompressionActivityBar
                phase="manual"
                summary={recompressStreamText}
                reasoning={recompressStreamReasoning}
                isActive
              />
            </>
          ) : (
            <>
              {view.compressionReasoningText ? (
                <ThinkingBlock
                  content={view.compressionReasoningText}
                  completedStatusLabel={t('agent.chat.thought_process', '思考过程')}
                  defaultOpen={false}
                />
              ) : null}
              {view.compressionSummaryText ? (
                <AgentMarkdownRenderer content={view.compressionSummaryText} variant="ancillary" />
              ) : (
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                  {t('agent.chat.no_content', '[无内容]')}
                </Text>
              )}
            </>
          )}
        </>
      )
    }

    if (!selected) {
      return (
        <Text style={{ fontSize: 14, color: colors.textSecondary }}>
          {t('agent.chat.no_content', '[无内容]')}
        </Text>
      )
    }

    if (selected.label === 'AI 思考' && selected.content) {
      return (
        <ThinkingBlock
          content={selected.content}
          completedStatusLabel={view.t('agent.chat.thought_process', '思考过程')}
          defaultOpen
        />
      )
    }

    if (selected.content) {
      return (
        <AgentMarkdownRenderer
          content={selected.content}
          variant={isSystemPrompt || selected.label === '系统提示词' ? 'chat' : 'ancillary'}
          plainText={isSystemPrompt || selected.label === '系统提示词'}
        />
      )
    }

    return (
      <Text style={{ fontSize: 14, color: colors.textSecondary }}>
        {t('agent.chat.no_content', '[无内容]')}
      </Text>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <Pressable onPress={onBack} hitSlop={8} style={styles.headerBack}>
            <Text style={{ fontSize: 20, color: colors.primary, lineHeight: 22 }}>‹</Text>
            <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '500' }}>
              {t('agent.chat.back', '返回')}
            </Text>
          </Pressable>
        </View>

        <View style={styles.headerSideRight}>
          <Pressable onPress={onClose} hitSlop={8} style={styles.headerClose}>
            <Text style={{ fontSize: 24, color: colors.textSecondary }}>×</Text>
          </Pressable>
        </View>

        <View style={styles.headerCenter} pointerEvents="none">
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: tokens.radius.full,
              backgroundColor: badgeColor + '20',
              maxWidth: '100%'
            }}
          >
            <Text
              style={{ fontSize: 12, fontWeight: '600', color: badgeColor, textAlign: 'center' }}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: tokens.spacing.md }}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={false}
        overScrollMode="never"
      >
        {renderBody()}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    width: '100%'
  },
  header: {
    height: 44,
    marginBottom: 8
  },
  headerSide: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: '50%',
    zIndex: 1,
    justifyContent: 'center'
  },
  headerSideRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    right: 0,
    zIndex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center'
  },
  headerBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start'
  },
  headerClose: {
    alignSelf: 'flex-end'
  },
  headerCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 72
  },
  divider: {
    height: 1,
    marginBottom: 8
  },
  scroll: {
    flex: 1,
    minHeight: 0
  }
})
