import React from 'react'
import { useTranslation } from 'react-i18next'
import { SettingsItem, SettingsSection } from '@baishou/ui/native'

export function KnowledgeNotebookStatusStrip(props: {
  embeddingLabel: string
  graphLabel: string
  visionLabel: string
  extractEngineLabel: string
  sourceCount: number
  embeddingConfigured: boolean
  graphConfigured: boolean
  visionConfigured: boolean
  onPickEmbedding?: () => void
  onPickGraph?: () => void
  onPickVision?: () => void
}) {
  const { t } = useTranslation()
  const missing = t('knowledge.model_not_configured', '未配置')
  return (
    <SettingsSection title={t('knowledge.notebook_manage', '笔记本管理')}>
      <SettingsItem
        title={t('knowledge.embedding_model', '嵌入模型')}
        subtitle={props.embeddingConfigured ? props.embeddingLabel : missing}
        onPress={props.onPickEmbedding}
      />
      <SettingsItem
        title={t('knowledge.graph_model', '图抽取模型')}
        subtitle={props.graphConfigured ? props.graphLabel : missing}
        onPress={props.onPickGraph}
      />
      <SettingsItem
        title={t('knowledge.vision_model', '视觉模型')}
        subtitle={props.visionConfigured ? props.visionLabel : missing}
        onPress={props.onPickVision}
      />
      <SettingsItem
        title={t('knowledge.default_engine', '默认提取方式')}
        subtitle={props.extractEngineLabel}
      />
      <SettingsItem
        title={t('knowledge.tab_sources', '资料')}
        subtitle={String(props.sourceCount)}
      />
    </SettingsSection>
  )
}
