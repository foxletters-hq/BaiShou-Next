import React, { useEffect, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  GRAPH_NODE_TYPE_LABEL_FALLBACKS,
  isGraphNodeSameNameConflict,
  type GraphSameNameExisting
} from '@baishou/shared'
import { FloatingModal, useNativeTheme } from '@baishou/ui/native'
import type { AppDatabase } from '@baishou/database'
import { mobileCreateNode, mobileFindNodeByName } from '@/src/services/mobile-graph.service'
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!props.visible) return
    setName('')
    setNodeType(CREATE_NODE_TYPES.includes('person') ? 'person' : (CREATE_NODE_TYPES[0] ?? 'topic'))
    setSummary('')
    setAliases('')
    setConflict(null)
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
        setConflict(hit && hit.id ? { id: hit.id, name: hit.name, nodeType: hit.nodeType, summary: hit.summary } : null)
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

  return (
    <FloatingModal visible={props.visible} onClose={props.onClose} closeOnBackdropPress={!saving}>
      <View style={{ padding: 20, gap: 10 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '700' }}>
          {t('graph.create_node', '新建节点')}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('graph.label_name', '名称')}
          placeholderTextColor={colors.textSecondary}
          style={{
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
            color: colors.textPrimary
          }}
        />
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
                <Text style={{ color: active ? colors.primary : colors.textSecondary, fontSize: 12 }}>
                  {t(`graph.node_type.${type}`, GRAPH_NODE_TYPE_LABEL_FALLBACKS[type] ?? type)}
                </Text>
              </Pressable>
            )
          })}
        </View>
        <TextInput
          value={summary}
          onChangeText={setSummary}
          placeholder={t('graph.label_summary', '摘要')}
          placeholderTextColor={colors.textSecondary}
          multiline
          style={{
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
            minHeight: 64,
            color: colors.textPrimary
          }}
        />
        {conflict ? (
          <Text style={{ color: colors.textPrimary, fontSize: 12, lineHeight: 18 }}>
            {t('graph.same_name_exists', '已有同类型同名节点「{{name}}」。请打开该节点，或换一个名称。', {
              name: conflict.name
            })}
          </Text>
        ) : null}
        {error ? (
          <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16 }}>
          <Pressable disabled={saving || props.busy} onPress={props.onClose}>
            <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
              {t('common.cancel', '取消')}
            </Text>
          </Pressable>
          {conflict ? (
            <Pressable disabled={saving} onPress={() => props.onOpenExisting(conflict.id)}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                {t('graph.open_existing_node', '打开已有节点')}
              </Text>
            </Pressable>
          ) : (
            <Pressable disabled={saving || props.busy || !name.trim()} onPress={() => void submit()}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                {t('graph.create_node_submit', '创建')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </FloatingModal>
  )
}
