import React, { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  GRAPH_NODE_TYPE_LABEL_FALLBACKS,
  isGraphNodeSameNameConflict,
  type GraphSameNameExisting
} from '@baishou/shared'
import { Button, FloatingModal, Input, useNativeTheme } from '@baishou/ui/native'
import type { AppDatabase } from '@baishou/database'
import { mobileCreateNode, mobileFindNodeByName } from '@/src/services/mobile-graph.service'
import { mobileSplitGraphNode } from '@/src/services/mobile-graph-split'
import type { IFileSystem, IStoragePathService } from '@baishou/core-mobile'

const CREATE_NODE_TYPES = Object.keys(GRAPH_NODE_TYPE_LABEL_FALLBACKS).filter((t) => t !== 'entry')

export function GraphCreateNodeSheet(props: {
  visible: boolean
  drizzleDb: AppDatabase | null
  pathService: IStoragePathService
  fileSystem: IFileSystem
  vaultId: string
  vaultName: string
  busy?: boolean
  onClose: () => void
  onCreated: (id: string) => void
  onOpenExisting: (id: string) => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
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
    if (!props.visible) return
    setName('')
    setNodeType(CREATE_NODE_TYPES.includes('person') ? 'person' : (CREATE_NODE_TYPES[0] ?? 'topic'))
    setSummary('')
    setAliases('')
    setConflict(null)
    setRegisterDiscriminator('')
    setRegisterLabel('')
    setError('')
  }, [props.visible])

  useEffect(() => {
    if (!props.visible || !props.drizzleDb) return
    const trimmed = name.trim()
    if (!trimmed) {
      setConflict(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      void mobileFindNodeByName(props.drizzleDb!, props.vaultId, trimmed, nodeType).then((hit) => {
        if (cancelled) return
        setConflict(
          hit && hit.id
            ? { id: hit.id, name: hit.name, nodeType: hit.nodeType, summary: hit.summary }
            : null
        )
      })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [props.visible, props.drizzleDb, props.vaultId, name, nodeType])

  const submit = async () => {
    if (!props.drizzleDb) return
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t('graph.create_name_required', '请先填写名称'))
      return
    }
    const hit = await mobileFindNodeByName(props.drizzleDb, props.vaultId, trimmed, nodeType)
    if (hit) {
      setConflict({ id: hit.id, name: hit.name, nodeType: hit.nodeType, summary: hit.summary })
      return
    }
    setSaving(true)
    setError('')
    try {
      const result = await mobileCreateNode({
        drizzleDb: props.drizzleDb,
        pathService: props.pathService,
        fileSystem: props.fileSystem,
        vaultId: props.vaultId,
        vaultDisplayName: props.vaultName,
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
      props.onCreated(result.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const registerAnother = async () => {
    if (!conflict || !props.drizzleDb) return
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
      const result = await mobileSplitGraphNode({
        drizzleDb: props.drizzleDb,
        pathService: props.pathService,
        fileSystem: props.fileSystem,
        vaultId: props.vaultId,
        vaultName: props.vaultName,
        bareNodeId: conflict.id,
        discriminator: disc,
        label: nextLabel,
        summary,
        edgeAssignments: []
      })
      props.onCreated(result.splitNodeId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FloatingModal visible={props.visible} onClose={props.onClose} closeOnBackdropPress={!saving}>
      <View style={{ padding: 20, gap: 10 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '700' }}>
          {t('graph.create_node', '新建节点')}
        </Text>
        <Input label={t('graph.label_name', '名称')} value={name} onChangeText={setName} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CREATE_NODE_TYPES.map((type) => {
            const active = nodeType === type
            return (
              <Pressable
                key={type}
                onPress={() => setNodeType(type)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.borderSubtle
                }}
              >
                <Text
                  style={{ color: active ? colors.primary : colors.textSecondary, fontSize: 12 }}
                >
                  {t(`graph.node_type.${type}`, GRAPH_NODE_TYPE_LABEL_FALLBACKS[type] ?? type)}
                </Text>
              </Pressable>
            )
          })}
        </View>
        <Input
          label={t('graph.label_summary', '摘要')}
          value={summary}
          onChangeText={setSummary}
          multiline
          textarea
        />
        {conflict ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 12, lineHeight: 18 }}>
              {t(
                'graph.same_name_exists',
                '已有同类型同名节点「{{name}}」。请打开该节点，或换一个名称。',
                {
                  name: conflict.name
                }
              )}
            </Text>
            <Input
              label={t('graph.discriminator_label', '区分信息')}
              value={registerDiscriminator}
              onChangeText={setRegisterDiscriminator}
            />
            <Input
              label={t('graph.split_label', '展示标签')}
              value={registerLabel}
              onChangeText={setRegisterLabel}
            />
          </View>
        ) : null}
        {error ? <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16 }}>
          <Button variant="outlined" disabled={saving || props.busy} onPress={props.onClose}>
            {t('common.cancel', '取消')}
          </Button>
          {conflict ? (
            <>
              <Button
                variant="outlined"
                disabled={saving}
                onPress={() => props.onOpenExisting(conflict.id)}
              >
                {t('graph.open_existing_node', '打开已有节点')}
              </Button>
              <Button disabled={saving} onPress={() => void registerAnother()}>
                {t('graph.register_another_entity', '登记为另一个实体')}
              </Button>
            </>
          ) : (
            <Button disabled={saving || props.busy || !name.trim()} onPress={() => void submit()}>
              {t('graph.create_node_submit', '创建')}
            </Button>
          )}
        </View>
      </View>
    </FloatingModal>
  )
}
