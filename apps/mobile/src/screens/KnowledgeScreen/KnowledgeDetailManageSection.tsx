import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { canConfirmNotebookDataManage, type NotebookDataManageAction } from '@baishou/shared'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import {
  Button,
  Checkbox,
  Input,
  Modal,
  modalActionsStyle,
  useNativeTheme
} from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import type { KnowledgeGraphEdgeRow, KnowledgeGraphNodeRow } from './knowledge-detail.types'

export function KnowledgeDetailManageSection(props: {
  graphNodes: KnowledgeGraphNodeRow[]
  graphEdges: KnowledgeGraphEdgeRow[]
  sourceCount: number
  manageAction?: NotebookDataManageAction
  manageVector: boolean
  manageGraph: boolean
  clearPhrase: string
  phrase: string
  canConfirm?: boolean
  busy: boolean
  onStartOrganize?: () => void
  onManageAction?: (v: NotebookDataManageAction) => void
  onToggleVector: () => void
  onToggleGraph: () => void
  onClearPhrase: (v: string) => void
  onConfirmManage: (action?: NotebookDataManageAction) => void | Promise<unknown>
  onConfirmClear?: () => void | Promise<unknown>
  onConfirmReprocess?: () => void | Promise<unknown>
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [clearModalOpen, setClearModalOpen] = useState(false)

  const {
    manageVector,
    manageGraph,
    clearPhrase,
    phrase,
    busy,
    onToggleVector,
    onToggleGraph,
    onClearPhrase,
    onConfirmManage,
    onConfirmClear,
    onConfirmReprocess
  } = props

  const labelStyle = {
    color: colors.textPrimary,
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: mobileTypography.primary.fontWeight,
    lineHeight: 20
  } as const

  const hintStyle = {
    color: colors.textSecondary,
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight,
    lineHeight: 20
  } as const

  const hasSelectedTarget = manageVector || manageGraph
  const canClearConfirm = canConfirmNotebookDataManage({
    action: 'clear',
    phrase,
    typed: clearPhrase,
    vector: manageVector,
    graph: manageGraph
  })

  const handleConfirmClear = async () => {
    if (!canClearConfirm || busy) return
    if (onConfirmClear) {
      await onConfirmClear()
    } else {
      await onConfirmManage('clear')
    }
    setClearModalOpen(false)
    onClearPhrase('')
  }

  const handleReprocess = async () => {
    if (!hasSelectedTarget || busy) return
    if (onConfirmReprocess) {
      await onConfirmReprocess()
    } else {
      await onConfirmManage('reprocess')
    }
  }

  return (
    <View style={{ gap: tokens.spacing.lg, paddingBottom: tokens.spacing.sm }}>
      <View style={{ gap: tokens.spacing.sm }}>
        <Text style={hintStyle}>
          {t(
            'knowledge.data_manage_reprocess_intro',
            '勾选要按当前模型重新整理或清除的数据。可能耗时较长。'
          )}
        </Text>
        <Text style={hintStyle}>
          {t('knowledge.graph_ops_hint', '重新抽取只会整理这本笔记本。人生关系图不会被改动。')}
        </Text>
      </View>

      <View style={{ gap: tokens.spacing.xsPlus }}>
        <Pressable
          onPress={onToggleVector}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: tokens.spacing.sm,
            paddingVertical: tokens.spacing.sm
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: manageVector }}
        >
          <Text style={[labelStyle, { flex: 1 }]}>
            {t('knowledge.data_manage_vector', '向量片段')}
          </Text>
          <Checkbox selected={manageVector} onPress={onToggleVector} />
        </Pressable>

        <Pressable
          onPress={onToggleGraph}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: tokens.spacing.sm,
            paddingVertical: tokens.spacing.sm
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: manageGraph }}
        >
          <Text style={[labelStyle, { flex: 1 }]}>
            {t('knowledge.data_manage_graph', '本笔记本图谱')}
          </Text>
          <Checkbox selected={manageGraph} onPress={onToggleGraph} />
        </Pressable>
      </View>

      <View style={[styles.submitActionsRow, modalActionsStyle]}>
        <Button
          size="sm"
          isDisabled={!hasSelectedTarget || busy}
          onPress={() => void handleReprocess()}
        >
          {t('knowledge.data_manage_reprocess', '重整理')}
        </Button>
        <Button
          size="sm"
          variant="outlined"
          destructive
          isDisabled={!hasSelectedTarget || busy}
          onPress={() => setClearModalOpen(true)}
        >
          {t('knowledge.data_manage_clear', '清除数据')}
        </Button>
      </View>

      <Modal
        visible={clearModalOpen}
        title={t('knowledge.data_manage_clear_title', '清除数据确认')}
        onClose={
          busy
            ? undefined
            : () => {
                setClearModalOpen(false)
                onClearPhrase('')
              }
        }
      >
        <View style={{ gap: tokens.spacing.sm }}>
          <Text style={hintStyle}>
            {t('knowledge.data_manage_clear_intro', '清除选中的本地衍生数据。原文文件不会被删除。')}
          </Text>
          <View style={{ gap: tokens.spacing.xs, marginTop: tokens.spacing.xs }}>
            <Text style={hintStyle}>
              {t('knowledge.data_manage_clear_confirm_hint', '请输入「{{phrase}}」确认清除：', {
                phrase
              })}
            </Text>
            <Input
              value={clearPhrase}
              onChangeText={onClearPhrase}
              placeholder={phrase}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View
            style={[styles.submitActionsRow, modalActionsStyle, { marginTop: tokens.spacing.sm }]}
          >
            <Button
              size="sm"
              variant="outlined"
              isDisabled={busy}
              onPress={() => {
                setClearModalOpen(false)
                onClearPhrase('')
              }}
            >
              {t('common.cancel', '取消')}
            </Button>
            <Button
              size="sm"
              destructive
              isDisabled={!canClearConfirm || busy}
              onPress={() => void handleConfirmClear()}
            >
              {t('knowledge.data_manage_clear', '清除数据')}
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  )
}
