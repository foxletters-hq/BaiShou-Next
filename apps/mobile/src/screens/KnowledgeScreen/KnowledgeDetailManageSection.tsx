import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { NotebookDataManageAction } from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Button, Checkbox, Input, SegmentedControl, SettingsSection, useNativeTheme } from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import type { KnowledgeGraphEdgeRow, KnowledgeGraphNodeRow } from './knowledge-detail.types'

export function KnowledgeDetailManageSection(props: {
  graphNodes: KnowledgeGraphNodeRow[]
  graphEdges: KnowledgeGraphEdgeRow[]
  sourceCount: number
  manageAction: NotebookDataManageAction
  manageVector: boolean
  manageGraph: boolean
  clearPhrase: string
  phrase: string
  canConfirm: boolean
  busy: boolean
  onStartOrganize: () => void
  onRebuildGraph: () => void
  onManageAction: (v: NotebookDataManageAction) => void
  onToggleVector: () => void
  onToggleGraph: () => void
  onClearPhrase: (v: string) => void
  onConfirmManage: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const {
    graphNodes,
    sourceCount,
    manageAction,
    manageVector,
    manageGraph,
    clearPhrase,
    phrase,
    canConfirm,
    busy,
    onStartOrganize,
    onRebuildGraph,
    onManageAction,
    onToggleVector,
    onToggleGraph,
    onClearPhrase,
    onConfirmManage
  } = props

  return (
    <>
      <SettingsSection title={t('knowledge.graph_panel', '本笔记本图谱')}>
        <View style={{ padding: tokens.spacing.md, gap: tokens.spacing.sm }}>
          {graphNodes.length === 0 ? (
            <View style={{ gap: tokens.spacing.sm }}>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: settingsTypography.row.fontSize,
                  fontWeight: settingsTypography.row.fontWeight
                }}
              >
                {t('knowledge.graph_empty_title', '还没有开始整理这本笔记本的关系')}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: settingsTypography.desc.fontSize,
                  fontWeight: settingsTypography.desc.fontWeight
                }}
              >
                {sourceCount > 0
                  ? t(
                      'knowledge.graph_empty_body',
                      '发现 {{count}} 个来源可以分析。整理后会显示人物、地点和事件关系；人生关系图不会被改动。',
                      { count: sourceCount }
                    )
                  : t(
                      'knowledge.graph_empty_no_sources',
                      '先导入资料，再开始整理这本笔记本里的关系。人生关系图是另一份数据，不会混进来。'
                    )}
              </Text>
              <Button isDisabled={sourceCount === 0 || busy} onPress={() => void onStartOrganize()}>
                {t('graph.start_organize', '开始整理')}
              </Button>
            </View>
          ) : null}
          <Button isDisabled={sourceCount === 0 || busy} onPress={() => void onRebuildGraph()}>
            {t('knowledge.rebuild_graph', '重新抽取图谱')}
          </Button>
        </View>
      </SettingsSection>

      <SettingsSection title={t('knowledge.data_manage', '数据管理')}>
        <View style={{ padding: tokens.spacing.md, gap: tokens.spacing.sm }}>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: settingsTypography.desc.fontSize,
              fontWeight: settingsTypography.desc.fontWeight
            }}
          >
            {t(
              'knowledge.data_manage_reprocess_intro',
              '勾选要按当前模型重新整理的数据。可能耗时较长。'
            )}
          </Text>
          <SegmentedControl
            value={manageAction}
            onChange={onManageAction}
            options={[
              { value: 'reprocess', label: t('knowledge.data_manage_reprocess', '重整理') },
              { value: 'clear', label: t('knowledge.data_manage_clear', '清除') }
            ]}
          />
          <View style={{ gap: tokens.spacing.sm }}>
            <View style={[styles.checkRow, { gap: tokens.spacing.sm }]}>
              <Checkbox selected={manageVector} onPress={onToggleVector} />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: settingsTypography.row.fontSize
                }}
              >
                {t('knowledge.data_manage_vector', '向量片段')}
              </Text>
            </View>
            <View style={[styles.checkRow, { gap: tokens.spacing.sm }]}>
              <Checkbox selected={manageGraph} onPress={onToggleGraph} />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: settingsTypography.row.fontSize
                }}
              >
                {t('knowledge.data_manage_graph', '本笔记本图谱')}
              </Text>
            </View>
          </View>
          {manageAction === 'clear' ? (
            <Input
              value={clearPhrase}
              onChangeText={onClearPhrase}
              placeholder={phrase}
            />
          ) : null}
          <Button
            isDisabled={!canConfirm || busy}
            destructive={manageAction === 'clear'}
            onPress={() => void onConfirmManage()}
          >
            {manageAction === 'clear'
              ? t('knowledge.data_manage_clear', '清除')
              : t('knowledge.data_manage_reprocess', '重整理')}
          </Button>
        </View>
      </SettingsSection>
    </>
  )
}
