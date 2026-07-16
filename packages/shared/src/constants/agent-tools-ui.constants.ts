/** 工具管理页分类（内置工具 Tab） */
export type AgentToolCategory = 'diary' | 'summary' | 'memory' | 'search' | 'general'

export interface AgentToolConfigurableParamDef {
  key: string
  labelKey: string
  type: 'integer' | 'boolean' | 'string' | 'select'
  defaultValue: unknown
  min?: number
  max?: number
  icon?: string
}

export interface AgentToolUiDef {
  id: string
  category: AgentToolCategory
  /** i18n key: agent.tools.* */
  nameKey: string
  tooltipKey: string
  /** 为 false 时 UI 开关固定开启（与 registry canBeDisabled 一致） */
  canBeDisabled?: boolean
  configurableParams?: AgentToolConfigurableParamDef[]
}

/**
 * 工具管理页「内置工具」完整列表（桌面 + 移动端共用）。
 * 顺序即页面展示顺序；分类内按数组顺序排列。
 */
export const AGENT_TOOL_UI_DEFS: readonly AgentToolUiDef[] = [
  {
    id: 'diary_read',
    category: 'diary',
    nameKey: 'agent.tools.diary_read',
    tooltipKey: 'agent.tools.diary_read_tooltip'
  },
  {
    id: 'diary_write',
    category: 'diary',
    nameKey: 'agent.tools.diary_write',
    tooltipKey: 'agent.tools.diary_write_tooltip'
  },
  {
    id: 'diary_edit',
    category: 'diary',
    nameKey: 'agent.tools.diary_edit',
    tooltipKey: 'agent.tools.diary_edit_tooltip'
  },
  {
    id: 'diary_delete',
    category: 'diary',
    nameKey: 'agent.tools.diary_delete',
    tooltipKey: 'agent.tools.diary_delete_tooltip'
  },
  {
    id: 'diary_list',
    category: 'diary',
    nameKey: 'agent.tools.diary_list',
    tooltipKey: 'agent.tools.diary_list_tooltip'
  },
  {
    id: 'diary_search',
    category: 'diary',
    nameKey: 'agent.tools.diary_search',
    tooltipKey: 'agent.tools.diary_search_tooltip',
    configurableParams: [
      {
        key: 'max_results',
        labelKey: 'agent.tools.param_max_results',
        type: 'integer',
        defaultValue: 10,
        min: 1,
        max: 50,
        icon: 'ListOrdered'
      }
    ]
  },
  {
    id: 'summary_read',
    category: 'summary',
    nameKey: 'agent.tools.summary_read',
    tooltipKey: 'agent.tools.summary_read_tooltip'
  },
  {
    id: 'message_search',
    category: 'memory',
    nameKey: 'agent.tools.message_search',
    tooltipKey: 'agent.tools.message_search_tooltip'
  },
  {
    id: 'vector_search',
    category: 'memory',
    nameKey: 'agent.tools.vector_search',
    tooltipKey: 'agent.tools.vector_search_desc'
  },
  {
    id: 'memory_store',
    category: 'memory',
    nameKey: 'agent.tools.memory_store',
    tooltipKey: 'agent.tools.memory_store_tooltip'
  },
  {
    id: 'memory_delete',
    category: 'memory',
    nameKey: 'agent.tools.memory_delete',
    tooltipKey: 'agent.tools.memory_delete_tooltip'
  },
  {
    id: 'recall_relations',
    category: 'memory',
    nameKey: 'agent.tools.recall_relations',
    tooltipKey: 'agent.tools.recall_relations_tooltip'
  },
  {
    id: 'graph_upsert',
    category: 'memory',
    nameKey: 'agent.tools.graph_upsert',
    tooltipKey: 'agent.tools.graph_upsert_tooltip'
  },
  {
    id: 'web_search',
    category: 'search',
    nameKey: 'agent.tools.web_search',
    tooltipKey: 'agent.tools.web_search_tooltip'
  },
  {
    id: 'url_read',
    category: 'search',
    nameKey: 'agent.tools.url_read',
    tooltipKey: 'agent.tools.url_read_tooltip'
  },
  {
    id: 'auto_inject_time',
    category: 'general',
    nameKey: 'agent.tools.auto_inject_time',
    tooltipKey: 'agent.tools.auto_inject_time_tooltip'
  },
  {
    id: 'current_time',
    category: 'general',
    nameKey: 'agent.tools.current_time',
    tooltipKey: 'agent.tools.current_time_tooltip',
    canBeDisabled: false
  }
] as const

/** 工具管理页分类展示顺序 */
export const AGENT_TOOL_CATEGORY_ORDER: readonly AgentToolCategory[] = [
  'diary',
  'summary',
  'memory',
  'search',
  'general'
] as const

/** 仅 UI 使用的虚拟工具（非模型可调用） */
export const AGENT_TOOL_UI_ONLY_IDS = ['auto_inject_time'] as const
