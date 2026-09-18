import i18n from 'i18next'
import { AGENT_TOOL_CATEGORY_ORDER, AGENT_TOOL_UI_DEFS } from '@baishou/shared'
import type { AgentToolDef } from './agent-tools.types'

const TOOL_NAME_FALLBACKS: Record<string, string> = {
  'agent.tools.diary_read': i18n.t(
    'auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L73',
    '日记读取'
  ),
  'agent.tools.diary_write': i18n.t(
    'auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L74',
    '日记写入'
  ),
  'agent.tools.diary_edit': i18n.t(
    'auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L75',
    '日记编辑'
  ),
  'agent.tools.diary_delete': i18n.t(
    'auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L76',
    '日记删除'
  ),
  'agent.tools.diary_list': i18n.t(
    'auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L77',
    '日记列表'
  ),
  'agent.tools.diary_search': i18n.t(
    'auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L78',
    '日记搜索'
  ),
  'agent.tools.summary_read': i18n.t(
    'auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L79',
    '总结读取'
  ),
  'agent.tools.message_search': i18n.t(
    'auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L80',
    '消息搜索'
  ),
  'agent.tools.vector_search': i18n.t(
    'auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L81',
    '语义搜索'
  ),
  'agent.tools.memory_store': i18n.t(
    'auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L82',
    '记忆存储'
  ),
  'agent.tools.memory_delete': i18n.t(
    'auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L83',
    '记忆删除'
  ),
  'agent.tools.recall_relations': i18n.t(
    'auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L84',
    '回忆人生关系图'
  ),
  'agent.tools.graph_upsert': i18n.t(
    'auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L85',
    '写入人生关系图'
  ),
  'agent.tools.skill_write': i18n.t(
    'auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L86',
    '保存技能'
  ),
  'agent.tools.web_search': i18n.t(
    'auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L87',
    '网络搜索'
  ),
  'agent.tools.url_read': i18n.t(
    'auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L88',
    '网页读取'
  ),
  'agent.tools.auto_inject_time': i18n.t(
    'auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L89',
    '当前时间'
  ),
  'agent.tools.current_time': i18n.t(
    'auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L90',
    '查询时间'
  ),
  'agent.tools.param_max_results': i18n.t(
    'auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L91',
    '搜索结果上限'
  )
}

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  diary: 'settings.agent_tools_category_diary',
  summary: 'settings.agent_tools_category_summary',
  memory: 'settings.agent_tools_category_memory',
  search: 'settings.agent_tools_category_search',
  general: 'settings.agent_tools_category_general'
}

const CATEGORY_LABEL_FALLBACKS: Record<string, string> = {
  diary: i18n.t('auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L103', '日记工具'),
  summary: i18n.t('auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L104', '总结工具'),
  memory: i18n.t('auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L105', '记忆工具'),
  search: i18n.t('auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L106', '搜索工具'),
  general: i18n.t('auto.packages.ui.src.native.AgentToolsView.AgentToolsView.L107', '通用工具')
}

export const getAgentTools = (t: (key: string, fallback: string) => string): AgentToolDef[] =>
  AGENT_TOOL_UI_DEFS.map((def) => ({
    id: def.id,
    category: def.category,
    name: t(def.nameKey, TOOL_NAME_FALLBACKS[def.nameKey] ?? def.id),
    tooltipKey: def.tooltipKey,
    canBeDisabled: def.canBeDisabled,
    configurableParams: def.configurableParams?.map((param) => ({
      key: param.key,
      label: t(param.labelKey, TOOL_NAME_FALLBACKS[param.labelKey] ?? param.key),
      type: param.type,
      defaultValue: param.defaultValue,
      min: param.min,
      max: param.max,
      icon: param.icon
    }))
  }))

export const getCategoryMeta = (t: (key: string, fallback: string) => string) =>
  Object.fromEntries(
    AGENT_TOOL_CATEGORY_ORDER.map((category) => [
      category,
      {
        label: t(CATEGORY_LABEL_KEYS[category], CATEGORY_LABEL_FALLBACKS[category])
      }
    ])
  )
