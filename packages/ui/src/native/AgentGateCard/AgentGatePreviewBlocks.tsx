import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { AgentGatePreview, AgentGateFileChangePreview } from '@baishou/shared'
import { formatFileChangeKindLabel } from '../../agent-gate/agent-gate-preview-copy'
import { useNativeTheme } from '../theme'
import { agentGateCardStyles as styles } from './agent-gate-card.styles'

export function AgentGatePreviewBlocks({
  filePreviews,
  expandedDiffs,
  onToggleDiff,
  preview,
  requestTitle
}: {
  filePreviews: AgentGateFileChangePreview[]
  expandedDiffs: Record<string, boolean>
  onToggleDiff: (path: string) => void
  preview: AgentGatePreview | undefined
  requestTitle: string
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <>
      {filePreviews.map((filePreview) => {
        const expanded = Boolean(expandedDiffs[filePreview.path])
        return (
          <View
            key={`${filePreview.kind}:${filePreview.path}:${filePreview.previousPath ?? ''}`}
            style={[
              styles.previewBlock,
              { borderColor: colors.borderMuted, backgroundColor: colors.bgApp }
            ]}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {formatFileChangeKindLabel(filePreview.kind)} · {filePreview.path}
              {filePreview.previousPath ? ` ← ${filePreview.previousPath}` : ''}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {filePreview.additions > 0 ? (
                <Text style={{ color: colors.success, fontWeight: '600' }}>
                  +{filePreview.additions}
                </Text>
              ) : null}
              {filePreview.additions > 0 && filePreview.deletions > 0 ? '  ' : null}
              {filePreview.deletions > 0 ? (
                <Text style={{ color: colors.error, fontWeight: '600' }}>
                  -{filePreview.deletions}
                </Text>
              ) : null}
              {filePreview.truncated ? `  ${t('agent_gate.diff_truncated', '预览已截断')}` : ''}
            </Text>
            {filePreview.diff ? (
              <>
                <Pressable onPress={() => onToggleDiff(filePreview.path)}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                    {expanded
                      ? t('agent_gate.collapse_diff', '收起 Diff')
                      : t('agent_gate.expand_diff', '展开 Diff')}
                  </Text>
                </Pressable>
                {expanded ? (
                  <ScrollView style={styles.diffScroll} nestedScrollEnabled>
                    <Text style={[styles.diffText, { color: colors.textPrimary }]}>
                      {filePreview.diff}
                    </Text>
                  </ScrollView>
                ) : null}
              </>
            ) : null}
          </View>
        )
      })}

      {preview?.type === 'command' ? (
        <View
          style={[
            styles.previewBlock,
            { borderColor: colors.borderMuted, backgroundColor: colors.bgApp }
          ]}
        >
          <Text style={[styles.commandText, { color: colors.textPrimary }]}>{preview.command}</Text>
          {preview.dangerReason ? (
            <Text style={[styles.hint, { color: colors.warning }]}>{preview.dangerReason}</Text>
          ) : null}
        </View>
      ) : null}

      {preview?.type === 'content' ? (
        <View
          style={[
            styles.previewBlock,
            { borderColor: colors.borderMuted, backgroundColor: colors.bgApp }
          ]}
        >
          {preview.subject && preview.subject !== requestTitle ? (
            <Text style={{ color: colors.textPrimary }}>{preview.subject}</Text>
          ) : null}
          {preview.summary &&
          !preview.detailLines?.some(
            (line) => line.includes(preview.summary!) || line.endsWith(preview.summary!)
          ) ? (
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{preview.summary}</Text>
          ) : null}
          {preview.detailLines?.map((line) => (
            <Text key={line} style={{ color: colors.textTertiary, fontSize: 12 }}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </>
  )
}
