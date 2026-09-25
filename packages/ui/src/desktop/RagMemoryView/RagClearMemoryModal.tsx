import i18n from 'i18next'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MEMORY_CLEAR_KINDS,
  MEMORY_CLEAR_VECTOR_KINDS,
  type MemoryClearKind
} from '@baishou/shared'
import { Button } from '../Button/Button'
import { Checkbox } from '../Checkbox/Checkbox'
import { Input } from '../Input/Input'
import { Modal } from '../Modal/Modal'
import styles from './RagMemoryView.module.css'

const KIND_COPY: Record<
  MemoryClearKind,
  { labelKey: string; label: string; hintKey: string; hint: string }
> = {
  diary: {
    labelKey: 'settings.rag_clear_kind_diary',
    label: i18n.t('auto.packages.ui.src.desktop.RagMemoryView.RagClearMemoryModal.L20', '日记向量'),
    hintKey: 'settings.rag_clear_kind_diary_hint',
    hint: i18n.t(
      'auto.packages.ui.src.desktop.RagMemoryView.RagClearMemoryModal.L22',
      '只删除检索用的向量，日记正文还在。'
    )
  },
  partner: {
    labelKey: 'settings.rag_clear_kind_partner',
    label: i18n.t('auto.packages.ui.src.desktop.RagMemoryView.RagClearMemoryModal.L26', '伙伴记忆'),
    hintKey: 'settings.rag_clear_kind_partner_hint',
    hint: i18n.t(
      'auto.packages.ui.src.desktop.RagMemoryView.RagClearMemoryModal.L28',
      '删除伙伴写下的记忆原文和对应向量。同步后其他设备上也会没有。'
    )
  },
  manual: {
    labelKey: 'settings.rag_clear_kind_manual',
    label: i18n.t('auto.packages.ui.src.desktop.RagMemoryView.RagClearMemoryModal.L32', '手动记忆'),
    hintKey: 'settings.rag_clear_kind_manual_hint',
    hint: i18n.t(
      'auto.packages.ui.src.desktop.RagMemoryView.RagClearMemoryModal.L34',
      '删除你手动添加的记忆原文和对应向量。同步后其他设备上也会没有。'
    )
  },
  graph_node: {
    labelKey: 'settings.rag_clear_kind_node',
    label: i18n.t('auto.packages.ui.src.desktop.RagMemoryView.RagClearMemoryModal.L38', '节点向量'),
    hintKey: 'settings.rag_clear_kind_node_hint',
    hint: i18n.t(
      'auto.packages.ui.src.desktop.RagMemoryView.RagClearMemoryModal.L40',
      '只删除图谱节点的检索向量，关系图上的人和连线还在。'
    )
  },
  life_graph: {
    labelKey: 'settings.rag_clear_kind_graph',
    label: i18n.t('auto.packages.ui.src.desktop.RagMemoryView.RagClearMemoryModal.L44', '关系图谱'),
    hintKey: 'settings.rag_clear_kind_graph_hint',
    hint: i18n.t(
      'auto.packages.ui.src.desktop.RagMemoryView.RagClearMemoryModal.L46',
      '删除本工作区人生关系图的节点和连线。同步后其他设备上的人生关系图也会变空。'
    )
  }
}

export type RagClearMemoryModalProps = {
  open: boolean
  busy?: boolean
  onClose: () => void
  onConfirm: (kinds: MemoryClearKind[]) => Promise<void>
}

export const RagClearMemoryModal: React.FC<RagClearMemoryModalProps> = ({
  open,
  busy = false,
  onClose,
  onConfirm
}) => {
  const { t } = useTranslation()
  const phrase = t('settings.rag_clear_all_confirm_phrase', '确认清除')
  const [selected, setSelected] = useState<Set<MemoryClearKind>>(
    () => new Set(MEMORY_CLEAR_VECTOR_KINDS)
  )
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!open) return
    setTyped('')
    setSelected(new Set(MEMORY_CLEAR_VECTOR_KINDS))
  }, [open])

  const selectedKinds = useMemo(
    () => MEMORY_CLEAR_KINDS.filter((kind) => selected.has(kind)),
    [selected]
  )
  const canSubmit = selectedKinds.length > 0 && typed === phrase && !busy

  const toggle = (kind: MemoryClearKind) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  const handleClose = () => {
    if (busy) return
    setTyped('')
    setSelected(new Set(MEMORY_CLEAR_VECTOR_KINDS))
    onClose()
  }

  return (
    <Modal
      isOpen={open}
      onClose={handleClose}
      closeOnOverlayClick={!busy}
      animation="fade"
      zIndex={3200}
      className={styles.clearModal}
      title={t('settings.rag_clear_all', '清除记忆')}
    >
      <p className={styles.clearIntro}>
        {t('settings.rag_clear_all_intro', '勾选要清除的记忆。清除后不能恢复。')}
      </p>
      <div className={styles.clearKinds}>
        {MEMORY_CLEAR_KINDS.map((kind) => {
          const copy = KIND_COPY[kind]
          const checked = selected.has(kind)
          return (
            <label
              key={kind}
              className={`${styles.clearKind}${checked ? ` ${styles.clearKindChecked}` : ''}`}
            >
              <Checkbox checked={checked} disabled={busy} onChange={() => toggle(kind)} />
              <span className={styles.clearKindText}>
                <span className={styles.clearKindLabel}>{t(copy.labelKey, copy.label)}</span>
                <span className={styles.clearKindHint}>{t(copy.hintKey, copy.hint)}</span>
              </span>
            </label>
          )
        })}
      </div>
      <p className={styles.clearConfirmHint}>
        {t('settings.rag_clear_all_type', '请在下方输入「{{phrase}}」以确认清除：', {
          phrase
        })}
      </p>
      <Input
        value={typed}
        disabled={busy}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter' && canSubmit) void onConfirm(selectedKinds)
        }}
        className={styles.clearPhrase}
      />
      <div className={styles.clearActions}>
        <Button type="button" variant="outlined" size="small" disabled={busy} onClick={handleClose}>
          {t('common.cancel', '取消')}
        </Button>
        <Button
          type="button"
          variant="outlined"
          size="small"
          disabled={!canSubmit}
          isLoading={busy}
          onClick={() => void onConfirm(selectedKinds)}
        >
          {t('settings.rag_clear_all', '清除记忆')}
        </Button>
      </div>
    </Modal>
  )
}
