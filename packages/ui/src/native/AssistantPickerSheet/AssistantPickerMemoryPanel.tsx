import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, Switch, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD,
  DEFAULT_ASSISTANT_CONTEXT_WINDOW,
  getDefaultCompressionSystemPrompt
} from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import { SettingsSliderRow } from '../settings/SettingsSliderRow'
import type {
  AssistantMemoryConfigPatch,
  AssistantPickerSheetAssistant
} from './assistant-picker-sheet.types'

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return String(value)
}

export function AssistantPickerMemoryPanel({
  assistant,
  isSaving,
  onSaveMemoryConfig
}: {
  assistant: AssistantPickerSheetAssistant | null
  isSaving?: boolean
  onSaveMemoryConfig?: (assistantId: string, updates: AssistantMemoryConfigPatch) => Promise<void>
}) {
  const { t, i18n } = useTranslation()
  const { colors } = useNativeTheme()

  const [contextWindow, setContextWindow] = useState(20)
  const [compressTokenThreshold, setCompressTokenThreshold] = useState(
    DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD
  )
  const [compressKeepTurns, setCompressKeepTurns] = useState(3)

  useEffect(() => {
    if (!assistant) return
    setContextWindow(assistant.contextWindow ?? DEFAULT_ASSISTANT_CONTEXT_WINDOW)
    setCompressTokenThreshold(
      (assistant.compressTokenThreshold ?? 0) > 0
        ? assistant.compressTokenThreshold!
        : DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD
    )
    setCompressKeepTurns(assistant.compressKeepTurns ?? 3)
  }, [assistant])

  const isUnlimitedContext = contextWindow < 0
  const isCompressDisabled = compressTokenThreshold <= 0

  const persist = useCallback(
    async (updates: AssistantMemoryConfigPatch) => {
      if (!assistant?.id || !onSaveMemoryConfig) return
      await onSaveMemoryConfig(assistant.id, updates)
    },
    [assistant?.id, onSaveMemoryConfig]
  )

  if (!assistant) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {t('agent.assistant.pick_for_memory', '请先选择一个伙伴以调整记忆设置')}
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.panel}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {t('agent.assistant.memory_label', '记忆')}
        </Text>
        {isSaving ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.bgSurfaceNormal, borderColor: colors.borderSubtle }
        ]}
      >
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('agent.assistant.context_window_label', '上下文轮数')}
          </Text>
          <HelpTooltip
            content={t(
              'agent.assistant.context_window_desc',
              '发送给模型的最近对话轮数。一轮以你的消息开始，包含 AI 的回复以及该轮内的工具调用；轮数越多记忆越长，但 Token 消耗也更高。'
            )}
            size={15}
          />
          <View style={styles.rowSpacer} />
          {!isUnlimitedContext ? (
            <Text style={[styles.value, { color: colors.primary }]}>
              {Math.round(contextWindow)}
            </Text>
          ) : null}
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {isUnlimitedContext
              ? t('agent.assistant.context_unlimited', '∞ 无限')
              : t('agent.assistant.context_limited', '有限')}
          </Text>
          <Switch
            value={isUnlimitedContext}
            onValueChange={(unlimited) => {
              const next = unlimited ? -1 : 20
              setContextWindow(next)
              void persist({ contextWindow: next })
            }}
          />
        </View>
        {!isUnlimitedContext ? (
          <SettingsSliderRow
            title=""
            value={contextWindow}
            min={2}
            max={100}
            step={1}
            onChange={(next) => {
              setContextWindow(next)
              void persist({ contextWindow: Math.round(next) })
            }}
            formatValue={(v) => String(Math.round(v))}
          />
        ) : null}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.bgSurfaceNormal, borderColor: colors.borderSubtle }
        ]}
      >
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('agent.assistant.compress_label', '自动压缩')}
          </Text>
          <View style={styles.rowSpacer} />
          {!isCompressDisabled ? (
            <Text style={[styles.value, { color: colors.primary }]}>
              {formatTokens(Math.round(compressTokenThreshold))}
            </Text>
          ) : null}
          <Switch
            value={!isCompressDisabled}
            onValueChange={(enabled) => {
              const next = enabled ? DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD : 0
              setCompressTokenThreshold(next)
              void persist({
                compressTokenThreshold: next,
                compressSystemPrompt: enabled
                  ? assistant.compressSystemPrompt?.trim() ||
                    getDefaultCompressionSystemPrompt(i18n.language)
                  : null
              })
            }}
          />
        </View>
        {!isCompressDisabled ? (
          <>
            <SettingsSliderRow
              title=""
              value={compressTokenThreshold}
              min={10000}
              max={1000000}
              step={10000}
              onChange={(next) => {
                const rounded = Math.round(next)
                setCompressTokenThreshold(rounded)
                void persist({ compressTokenThreshold: rounded })
              }}
              formatValue={(v) => formatTokens(Math.round(v))}
            />
            <SettingsSliderRow
              title={t('agent.assistant.compress_keep_turns_label', '保留互动轮数')}
              description={t(
                'agent.assistant.compress_keep_turns_desc',
                '触发压缩时，保留最近若干轮完整原文。'
              )}
              value={compressKeepTurns}
              min={1}
              max={10}
              step={1}
              onChange={(next) => {
                const rounded = Math.round(next)
                setCompressKeepTurns(rounded)
                void persist({ compressKeepTurns: rounded })
              }}
              formatValue={(v) => String(Math.round(v))}
            />
          </>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    gap: 12
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600'
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  rowSpacer: {
    flex: 1
  },
  label: {
    fontSize: 14,
    fontWeight: '600'
  },
  value: {
    fontSize: 13,
    fontWeight: '600'
  },
  hint: {
    fontSize: 12
  },
  emptyWrap: {
    paddingVertical: 24,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center'
  }
})
