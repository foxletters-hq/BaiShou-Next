import i18n from 'i18next'
import React, { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  MEMORY_CLEAR_KINDS,
  MEMORY_CLEAR_VECTOR_KINDS,
  type MemoryClearKind
} from '@baishou/shared'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import {
  Button,
  Checkbox,
  Input,
  Modal,
  modalActionsStyle,
  useNativeTheme
} from '@baishou/ui/native'

const KIND_LABEL: Record<MemoryClearKind, { label: string; hint: string }> = {
  diary: { label: 'settings.rag_clear_kind_diary', hint: 'settings.rag_clear_kind_diary_hint' },
  partner: {
    label: 'settings.rag_clear_kind_partner',
    hint: 'settings.rag_clear_kind_partner_hint'
  },
  manual: { label: 'settings.rag_clear_kind_manual', hint: 'settings.rag_clear_kind_manual_hint' },
  graph_node: { label: 'settings.rag_clear_kind_node', hint: 'settings.rag_clear_kind_node_hint' },
  life_graph: { label: 'settings.rag_clear_kind_graph', hint: 'settings.rag_clear_kind_graph_hint' }
}

const KIND_FALLBACK: Record<MemoryClearKind, { label: string; hint: string }> = {
  diary: {
    label: i18n.t('settings.rag_clear_kind_diary', '日记向量'),
    hint: i18n.t('settings.rag_clear_kind_diary_hint', '只删除检索用的向量，日记正文还在。')
  },
  partner: {
    label: i18n.t('settings.rag_clear_kind_partner', '伙伴记忆'),
    hint: i18n.t('settings.rag_clear_kind_partner_hint', '删除伙伴写下的记忆原文和对应向量。')
  },
  manual: {
    label: i18n.t('settings.rag_clear_kind_manual', '手动记忆'),
    hint: i18n.t('settings.rag_clear_kind_manual_hint', '删除你手动添加的记忆原文和对应向量。')
  },
  graph_node: {
    label: i18n.t('settings.rag_clear_kind_node', '节点向量'),
    hint: i18n.t(
      'settings.rag_clear_kind_node_hint',
      '只删除图谱节点的检索向量，关系图上的人和连线还在。'
    )
  },
  life_graph: {
    label: i18n.t('settings.rag_clear_kind_graph', '关系图谱'),
    hint: i18n.t('settings.rag_clear_kind_graph_hint', '删除本工作区人生关系图的节点和连线。')
  }
}

export function MemoryClearKindsModal(props: {
  visible: boolean
  onCancel: () => void
  onConfirm: (kinds: MemoryClearKind[], phrase: string) => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [selected, setSelected] = useState<Set<MemoryClearKind>>(
    () => new Set(MEMORY_CLEAR_VECTOR_KINDS)
  )
  const [phrase, setPhrase] = useState('')
  const expected = t('settings.rag_clear_all_confirm_phrase', '确认清除')

  const toggle = (kind: MemoryClearKind) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  return (
    <Modal
      visible={props.visible}
      title={t('settings.rag_clear_all', '清除记忆')}
      onClose={props.onCancel}
    >
      <ScrollView
        style={{ flexGrow: 0, flexShrink: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingRight: tokens.spacing.mdTight }}
      >
        {MEMORY_CLEAR_KINDS.map((kind) => {
          const isChecked = selected.has(kind)
          return (
            <Pressable
              key={kind}
              onPress={() => toggle(kind)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isChecked }}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: tokens.spacing.sm,
                  marginBottom: tokens.spacing.sm,
                  paddingVertical: tokens.spacing.xs,
                  opacity: pressed ? 0.7 : 1
                }
              ]}
            >
              <View pointerEvents="none">
                <Checkbox
                  selected={isChecked}
                  accessibilityLabel={t(KIND_LABEL[kind].label, KIND_FALLBACK[kind].label)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: mobileTypography.primary.fontSize,
                    fontWeight: mobileTypography.secondary.fontWeight
                  }}
                >
                  {t(KIND_LABEL[kind].label, KIND_FALLBACK[kind].label)}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: mobileTypography.secondary.fontSize
                  }}
                >
                  {t(KIND_LABEL[kind].hint, KIND_FALLBACK[kind].hint)}
                </Text>
              </View>
            </Pressable>
          )
        })}
      </ScrollView>
      <Input
        value={phrase}
        onChangeText={setPhrase}
        placeholder={t('settings.rag_clear_all_confirm_phrase', '确认清除')}
      />
      <View style={modalActionsStyle}>
        <Button size="sm" variant="outlined" onPress={props.onCancel}>
          {t('common.cancel', '取消')}
        </Button>
        <Button
          size="sm"
          destructive
          isDisabled={selected.size === 0 || phrase.trim() !== expected}
          onPress={() => props.onConfirm([...selected], phrase.trim())}
        >
          {t('common.confirm', '确定')}
        </Button>
      </View>
    </Modal>
  )
}
