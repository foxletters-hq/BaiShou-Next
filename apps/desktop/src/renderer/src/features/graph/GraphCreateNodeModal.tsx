import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  GRAPH_NODE_TYPE_LABEL_FALLBACKS,
  isGraphNodeSameNameConflict,
  type GraphSameNameExisting
} from '@baishou/shared'
import { Button, Input, Modal, Select } from '@baishou/ui'
import { findGraphSameNameNode } from './graph-same-name.lookup'
import styles from './GraphPage.module.css'

const CREATE_NODE_TYPES = Object.keys(GRAPH_NODE_TYPE_LABEL_FALLBACKS).filter((t) => t !== 'entry')

export const GraphCreateNodeModal: React.FC<{
  isOpen: boolean
  busy?: boolean
  onClose: () => void
  onCreated: (id: string) => void
  onOpenExisting: (id: string) => void
}> = ({ isOpen, busy, onClose, onCreated, onOpenExisting }) => {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [nodeType, setNodeType] = useState('person')
  const [summary, setSummary] = useState('')
  const [aliases, setAliases] = useState('')
  const [conflict, setConflict] = useState<GraphSameNameExisting | null>(null)
  const [registerDiscriminator, setRegisterDiscriminator] = useState('')
  const [registerLabel, setRegisterLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setName('')
    setNodeType(CREATE_NODE_TYPES.includes('person') ? 'person' : (CREATE_NODE_TYPES[0] ?? 'topic'))
    setSummary('')
    setAliases('')
    setConflict(null)
    setRegisterDiscriminator('')
    setRegisterLabel('')
    setError('')
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const trimmed = name.trim()
    if (!trimmed) {
      setConflict(null)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void findGraphSameNameNode({ name: trimmed, nodeType })
        .then((hit) => {
          if (!cancelled) setConflict(hit)
        })
        .catch(() => {
          if (!cancelled) setConflict(null)
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [isOpen, name, nodeType])

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t('graph.create_name_required', '请先填写名称'))
      return
    }
    const hit = await findGraphSameNameNode({ name: trimmed, nodeType })
    if (hit) {
      setConflict(hit)
      return
    }
    setSaving(true)
    setError('')
    try {
      const result = await window.api.graph.upsertNode({
        name: trimmed,
        nodeType,
        summary,
        aliases: aliases
          .split(/[,，、]/)
          .map((s) => s.trim())
          .filter(Boolean)
      })
      if (isGraphNodeSameNameConflict(result)) {
        setConflict(result.existing)
        return
      }
      onCreated(result.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const registerAnother = async () => {
    if (!conflict) return
    const disc = registerDiscriminator.trim()
    const nextLabel = registerLabel.trim() || name.trim()
    if (!disc) {
      setError(t('graph.split_discriminator_required', '请填写区分信息'))
      return
    }
    if (!nextLabel) {
      setError(t('graph.split_label_required', '请填写展示标签'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const result = await window.api.graph.splitNode({
        bareNodeId: conflict.id,
        discriminator: disc,
        label: nextLabel,
        summary,
        edgeAssignments: []
      })
      onCreated(result.splitNodeId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('graph.create_node', '新建节点')}
      className={styles.graphFormModal}
      zIndex={1850}
    >
      <div className={styles.detailBlock}>
        <div className={styles.detailLabel}>{t('graph.label_name', '名称')}</div>
        <Input
          fieldSize="small"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
      <div className={styles.detailBlock}>
        <div className={styles.detailLabel}>{t('graph.label_type', '类型')}</div>
        <Select
          size="small"
          value={nodeType}
          onChange={(e) => setNodeType(e.target.value)}
          options={CREATE_NODE_TYPES.map((type) => ({
            value: type,
            label: t(`graph.node_type.${type}`, GRAPH_NODE_TYPE_LABEL_FALLBACKS[type] ?? type)
          }))}
        />
      </div>
      <div className={styles.detailBlock}>
        <div className={styles.detailLabel}>{t('graph.label_summary', '摘要')}</div>
        <textarea
          className={styles.editArea}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
        />
      </div>
      <div className={styles.detailBlock}>
        <div className={styles.detailLabel}>{t('graph.label_aliases', '别名')}</div>
        <Input
          fieldSize="small"
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
          placeholder={t('graph.aliases_placeholder', '逗号分隔')}
        />
      </div>
      {conflict ? (
        <div className={styles.sameNameBanner}>
          {t(
            'graph.same_name_exists',
            '已有同类型同名节点「{{name}}」。请打开该节点，登记为另一个实体，或换一个名称。',
            { name: conflict.name }
          )}
        </div>
      ) : null}
      {conflict ? (
        <>
          <div className={styles.detailBlock}>
            <div className={styles.detailLabel}>{t('graph.discriminator_label', '区分信息')}</div>
            <Input
              fieldSize="small"
              value={registerDiscriminator}
              onChange={(e) => setRegisterDiscriminator(e.target.value)}
            />
          </div>
          <div className={styles.detailBlock}>
            <div className={styles.detailLabel}>{t('graph.split_label', '展示标签')}</div>
            <Input
              fieldSize="small"
              value={registerLabel}
              onChange={(e) => setRegisterLabel(e.target.value)}
              placeholder={name.trim()}
            />
          </div>
        </>
      ) : null}
      {error ? <div className={styles.sameNameBanner}>{error}</div> : null}
      <div className={styles.mergeDialogFooter}>
        <Button type="button" disabled={saving || busy} onClick={onClose}>
          {t('common.cancel', '取消')}
        </Button>
        {conflict ? (
          <>
            <Button
              type="button"
              disabled={saving || busy}
              onClick={() => onOpenExisting(conflict.id)}
            >
              {t('graph.open_existing_node', '打开已有节点')}
            </Button>
            <Button
              type="button"
              disabled={saving || busy || !registerDiscriminator.trim()}
              onClick={() => void registerAnother()}
            >
              {t('graph.register_another_entity', '登记为另一个实体')}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            disabled={saving || busy || !name.trim()}
            onClick={() => void submit()}
          >
            {t('graph.create_node_submit', '创建')}
          </Button>
        )}
      </div>
    </Modal>
  )
}
