import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { useNativeTheme } from '../theme'
import type { CallChainFlatEntry } from './context-chain-panel.types'
import { getLabelBadgeColor } from './context-chain-dialog.utils'
import { COMPRESSION_SUMMARY_SELECTION_KEY, useContextChainView } from './useContextChainView'
import { contextChainFlatListStyles as styles } from './context-chain-flat-list.styles'

type ContextChainView = ReturnType<typeof useContextChainView>

interface ContextChainFlatListProps {
  view: ContextChainView
  onOpenDetail: (detailKey: string) => void
}

function getBadgeSurface(label: string, colors: ReturnType<typeof useNativeTheme>['colors']) {
  const color = getLabelBadgeColor(label, colors)
  if (label === '用户') {
    return {
      color,
      backgroundColor: 'rgba(59, 130, 246, 0.14)',
      borderColor: 'rgba(59, 130, 246, 0.32)'
    }
  }
  if (label === 'AI 思考') {
    return {
      color: '#7c3aed',
      backgroundColor: 'rgba(139, 92, 246, 0.12)',
      borderColor: 'rgba(139, 92, 246, 0.24)'
    }
  }
  if (label === 'AI 输出') {
    return {
      color,
      backgroundColor: `${color}1A`,
      borderColor: `${color}33`
    }
  }
  if (label === '工具调用') {
    return {
      color: colors.textTertiary,
      backgroundColor: 'rgba(100, 116, 139, 0.1)',
      borderColor: 'rgba(100, 116, 139, 0.22)'
    }
  }
  return {
    color,
    backgroundColor: `${color}1A`,
    borderColor: `${color}33`
  }
}

export const ContextChainFlatList: React.FC<ContextChainFlatListProps> = ({
  view,
  onOpenDetail
}) => {
  const { colors } = useNativeTheme()

  const hasSystemPromptCard = Boolean(view.systemPromptEntry?.item)
  const hasCompressionCard = Boolean(view.compressionSummaryEntry?.summaryText?.trim())

  if (view.flatEntries.length === 0) {
    return (
      <Text
        style={{
          fontSize: 14,
          color: colors.textSecondary,
          paddingVertical: 24,
          textAlign: 'center'
        }}
      >
        {view.t('agent.chat.no_context_messages', '暂无发送给 AI 的上下文记录')}
      </Text>
    )
  }

  const renderMetaChip = (params: { key: string; label: string; detailKey: string }) => {
    const badge = getBadgeSurface(params.label, colors)
    return (
      <Pressable
        key={params.key}
        onPress={() => onOpenDetail(params.detailKey)}
        style={[
          styles.metaChip,
          {
            borderColor: colors.borderSubtle,
            backgroundColor: colors.bgSurface
          }
        ]}
      >
        <View
          style={[
            styles.roleBadge,
            {
              backgroundColor: badge.backgroundColor,
              borderWidth: 1,
              borderColor: badge.borderColor
            }
          ]}
        >
          <Text style={[styles.roleBadgeText, { color: badge.color }]} numberOfLines={1}>
            {params.label}
          </Text>
        </View>
        <Text style={{ fontSize: 16, color: colors.textTertiary }}>›</Text>
      </Pressable>
    )
  }

  const renderChainMessage = (
    entry: CallChainFlatEntry & { kind: 'message'; item: NonNullable<CallChainFlatEntry['item']> },
    idx: number
  ) => {
    const msg = entry.item
    const label = view.getMessageLabel(msg)
    const badge = getBadgeSurface(label, colors)
    const preview =
      msg.label === '工具调用'
        ? view.formatToolPreview(msg.content)
        : msg.content
          ? view.formatPreview(msg.content)
          : view.t('agent.chat.empty_content', '[空文本]')

    return (
      <Pressable
        key={msg.id ?? `msg-${idx}`}
        onPress={() => msg.id && onOpenDetail(msg.id)}
        style={styles.messageItem}
      >
        <View style={styles.messageTopRow}>
          <View
            style={[
              styles.roleBadge,
              {
                backgroundColor: badge.backgroundColor,
                borderWidth: 1,
                borderColor: badge.borderColor
              }
            ]}
          >
            <Text style={[styles.roleBadgeText, { color: badge.color }]}>{label}</Text>
          </View>
          <Text style={{ fontSize: 16, color: colors.textTertiary }}>›</Text>
        </View>
        <Text style={[styles.messagePreview, { color: colors.textSecondary }]} numberOfLines={2}>
          {preview}
        </Text>
      </Pressable>
    )
  }

  const systemPromptId = view.systemPromptEntry?.item?.id

  return (
    <View>
      {(hasSystemPromptCard || hasCompressionCard) && (
        <View style={styles.metaRow}>
          {hasSystemPromptCard &&
            renderMetaChip({
              key: 'chain-system-prompt',
              label: view.getMessageLabel(view.systemPromptEntry!.item!),
              detailKey: systemPromptId ?? 'chain-system-prompt'
            })}
          {hasCompressionCard &&
            renderMetaChip({
              key: 'chain-compression',
              label: view.t('agent.chat.compaction_summary', '对话压缩'),
              detailKey: COMPRESSION_SUMMARY_SELECTION_KEY
            })}
        </View>
      )}

      {hasCompressionCard && (
        <Text style={[styles.compressionHint, { color: colors.textSecondary }]}>
          {view.t('agent.chat.compaction_between_rounds', '已压缩更早轮次，以下从第 1 轮重新计数')}
        </Text>
      )}

      {view.roundGroups.map((group) => {
        const expanded = view.isRoundExpanded(group.roundIndex)
        const isActiveRound =
          group.roundIndex === (view.meta?.activeRoundIndex ?? view.resolveDefaultActiveRound())
        const visibleMessages = view.getVisibleMessages(group)

        return (
          <View key={`round-wrap-${group.roundIndex}`}>
            <Pressable
              onPress={() => view.toggleRound(group.roundIndex)}
              style={styles.roundHeader}
            >
              <Text
                style={[
                  styles.roundChevron,
                  { color: isActiveRound ? colors.primary : colors.textTertiary },
                  expanded && { transform: [{ rotate: '90deg' }] }
                ]}
              >
                ▶
              </Text>
              <Text
                style={[
                  styles.roundLabel,
                  { color: isActiveRound ? colors.primary : colors.textSecondary }
                ]}
              >
                {view.t('agent.chat.round_label', '第 {{n}} 轮', { n: group.roundIndex })}
                {isActiveRound ? `（${view.t('agent.chat.current_round', '当前')}）` : ''}
              </Text>
              <Text style={[styles.roundMeta, { color: colors.textSecondary }]}>
                {group.messages.length}
                {view.t('agent.chat.round_items', ' 条')}
              </Text>
            </Pressable>

            {expanded ? (
              <View style={styles.roundBody}>
                {visibleMessages.map((entry, idx) => renderChainMessage(entry, idx))}
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}
