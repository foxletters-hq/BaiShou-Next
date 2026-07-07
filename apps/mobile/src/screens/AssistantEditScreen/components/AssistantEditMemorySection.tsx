import type { TFunction } from 'i18next'
import { View, Text, TouchableOpacity } from 'react-native'
import {
  Switch,
  Input,
  SettingsSliderRow,
  SettingsGroupCard,
  settingsCardStyles
} from '@baishou/ui/native'
import {
  DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD,
  getDefaultCompressionSystemPrompt
} from '@baishou/shared'
import { assistantEditScreenStyles as styles } from '../assistant-edit-screen.styles'
import { formatKeepTurns, formatTokens } from '../assistant-edit-format.util'

export type AssistantEditMemorySectionProps = {
  colors: Record<string, string>
  t: TFunction
  i18nLanguage: string
  isUnlimitedContext: boolean
  contextWindow: number
  setContextWindow: (v: number) => void
  isCompressDisabled: boolean
  compressTokenThreshold: number
  setCompressTokenThreshold: (v: number) => void
  compressKeepTurns: number
  setCompressKeepTurns: (v: number) => void
  compressSystemPrompt: string
  setCompressSystemPrompt: (v: string) => void
  persistMemoryConfig: (updates: Record<string, unknown>) => void | Promise<void>
}

export function AssistantEditMemorySection(props: AssistantEditMemorySectionProps) {
  const {
    colors,
    t,
    i18nLanguage,
    isUnlimitedContext,
    contextWindow,
    setContextWindow,
    isCompressDisabled,
    compressTokenThreshold,
    setCompressTokenThreshold,
    compressKeepTurns,
    setCompressKeepTurns,
    compressSystemPrompt,
    setCompressSystemPrompt,
    persistMemoryConfig
  } = props

  return (
    <SettingsGroupCard>
      <Text style={[settingsCardStyles.cardTitle, { color: colors.textPrimary }]}>
        {t('agent.assistant.memory_label', '记忆')}
      </Text>

      <View style={styles.row}>
        <Text style={[settingsCardStyles.label, { color: colors.textPrimary }]}>
          {t('agent.assistant.context_window_label', '上下文轮数')}
        </Text>
        <View style={styles.rowSpacer} />
        {!isUnlimitedContext ? (
          <Text style={[styles.valueText, { color: colors.textPrimary }]}>
            {Math.round(contextWindow)}
          </Text>
        ) : null}
        <Text style={[settingsCardStyles.hint, { color: colors.textSecondary, marginTop: 0 }]}>
          {isUnlimitedContext
            ? t('agent.assistant.context_unlimited', '∞ 无限')
            : t('agent.assistant.context_limited', '有限')}
        </Text>
        <Switch
          value={isUnlimitedContext}
          onValueChange={(unlimited) => {
            const next = unlimited ? -1 : 20
            setContextWindow(next)
            void persistMemoryConfig({ contextWindow: next })
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
            void persistMemoryConfig({ contextWindow: Math.round(next) })
          }}
          formatValue={(v) => String(Math.round(v))}
        />
      ) : null}

      <Text style={[settingsCardStyles.hint, { color: colors.textSecondary }]}>
        {isUnlimitedContext
          ? t(
              'agent.assistant.context_unlimited_desc',
              '不限制轮数，将发送全部对话历史（每轮含你的消息、AI 回复及工具调用）给模型。'
            )
          : t(
              'agent.assistant.context_window_desc',
              '发送给模型的最近对话轮数。一轮以你的消息开始，包含 AI 的回复以及该轮内的工具调用；轮数越多记忆越长，但 Token 消耗也更高。'
            )}
      </Text>

      <View style={[styles.sectionDivider, { backgroundColor: colors.borderSubtle }]} />

      <View style={styles.row}>
        <Text style={[settingsCardStyles.label, { color: colors.textPrimary }]}>
          {t('agent.assistant.compress_label', '自动压缩')}
        </Text>
        <View style={styles.rowSpacer} />
        {!isCompressDisabled ? (
          <Text style={[styles.valueText, { color: colors.textPrimary }]}>
            {formatTokens(Math.round(compressTokenThreshold))}
          </Text>
        ) : null}
        <Switch
          value={!isCompressDisabled}
          onValueChange={(enabled) => {
            const next = enabled ? DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD : 0
            setCompressTokenThreshold(next)
            void persistMemoryConfig({
              compressTokenThreshold: next,
              compressSystemPrompt: enabled
                ? compressSystemPrompt.trim() || getDefaultCompressionSystemPrompt(i18nLanguage)
                : null
            })
          }}
        />
      </View>

      <Text style={[settingsCardStyles.hint, { color: colors.textSecondary }]}>
        {isCompressDisabled
          ? t('agent.assistant.compress_disabled_desc', '对话不会自动压缩，所有消息将完整保留')
          : t('agent.assistant.compress_enabled_desc', '对话超过阈值时自动将旧消息压缩为摘要')}
      </Text>

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
              void persistMemoryConfig({ compressTokenThreshold: rounded })
            }}
            formatValue={(v) => formatTokens(Math.round(v))}
          />
          <SettingsSliderRow
            title={t('agent.assistant.compress_keep_turns_label', '保留互动轮数')}
            description={t(
              'agent.assistant.compress_keep_turns_desc',
              '触发压缩时，保留最近若干轮完整原文。一轮以你的消息开始，包含 AI 回复及该轮内的工具调用；更早的轮次会被压缩为摘要。'
            )}
            value={compressKeepTurns}
            min={1}
            max={10}
            step={1}
            onChange={(next) => {
              const rounded = Math.round(next)
              setCompressKeepTurns(rounded)
              void persistMemoryConfig({ compressKeepTurns: rounded })
            }}
            formatValue={(v) => formatKeepTurns(t, v)}
          />

          <View style={[styles.sectionDivider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.row}>
            <Text style={[settingsCardStyles.label, { color: colors.textPrimary }]}>
              {t('agent.assistant.compress_system_prompt_label', '压缩提示词')}
            </Text>
            <View style={styles.rowSpacer} />
            <TouchableOpacity
              onPress={() =>
                setCompressSystemPrompt(getDefaultCompressionSystemPrompt(i18nLanguage))
              }
            >
              <Text style={[styles.resetLink, { color: colors.primary }]}>
                {t('agent.assistant.compress_system_prompt_reset', '恢复默认')}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[settingsCardStyles.hint, { color: colors.textSecondary }]}>
            {t(
              'agent.assistant.compress_system_prompt_desc',
              '生成对话压缩摘要时发给模型的系统指令。可自定义压缩时的思考方式与摘要规则。'
            )}
          </Text>
          <Input
            textarea
            multiline
            value={compressSystemPrompt}
            onChangeText={setCompressSystemPrompt}
            style={styles.compressPromptInput}
            textAlignVertical="top"
          />
        </>
      ) : null}
    </SettingsGroupCard>
  )
}
