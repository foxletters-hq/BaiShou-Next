import React from 'react'
import {
  Puzzle,
  Book,
  Palette,
  Globe,
  BookOpen,
  PenSquare,
  Trash2,
  List,
  Search,
  FileText,
  MessageSquare,
  Database,
  DatabaseZap
} from 'lucide-react'
import type { AgentToolDef } from './agent-tools.types'

export function buildAgentTools(t: (key: string, fallback: string) => string): AgentToolDef[] {
  return [
    {
      id: 'diary_read',
      category: 'diary',
      name: t('agent.tools.diary_read', '日记读取'),
      icon: <BookOpen size={20} />,
      tooltipKey: 'agent.tools.diary_read_tooltip'
    },
    {
      id: 'diary_edit',
      category: 'diary',
      name: t('agent.tools.diary_edit', '日记编辑'),
      icon: <PenSquare size={20} />,
      tooltipKey: 'agent.tools.diary_edit_tooltip'
    },
    {
      id: 'diary_delete',
      category: 'diary',
      name: t('agent.tools.diary_delete', '日记删除'),
      icon: <Trash2 size={20} />,
      tooltipKey: 'agent.tools.diary_delete_tooltip'
    },
    {
      id: 'diary_list',
      category: 'diary',
      name: t('agent.tools.diary_list', '日记列表'),
      icon: <List size={20} />,
      tooltipKey: 'agent.tools.diary_list_tooltip'
    },
    {
      id: 'diary_search',
      category: 'diary',
      name: t('agent.tools.diary_search', '日记搜索'),
      icon: <Search size={20} />,
      tooltipKey: 'agent.tools.diary_search_tooltip',
      configurableParams: [
        {
          key: 'max_results',
          label: t('agent.tools.param_max_results', '搜索结果上限'),
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
      name: t('agent.tools.summary_read', '总结读取'),
      icon: <FileText size={20} />,
      tooltipKey: 'agent.tools.summary_read_tooltip'
    },
    {
      id: 'message_search',
      category: 'memory',
      name: t('agent.tools.message_search', '消息搜索'),
      icon: <MessageSquare size={20} />,
      tooltipKey: 'agent.tools.message_search_tooltip'
    },
    {
      id: 'memory_store',
      category: 'memory',
      name: t('agent.tools.memory_store', '记忆存储'),
      icon: <Database size={20} />,
      tooltipKey: 'agent.tools.memory_store_tooltip'
    },
    {
      id: 'memory_delete',
      category: 'memory',
      name: t('agent.tools.memory_delete', '记忆删除'),
      icon: <DatabaseZap size={20} />,
      tooltipKey: 'agent.tools.memory_delete_tooltip'
    }
  ]
}

export function buildCategoryMeta(
  t: (key: string, fallback: string) => string
): Record<string, { label: string; icon: React.ReactNode }> {
  return {
    diary: {
      label: t('settings.agent_tools_category_diary', '日记工具'),
      icon: <Book size={18} />
    },
    summary: {
      label: t('settings.agent_tools_category_summary', '总结工具'),
      icon: <FileText size={18} />
    },
    memory: {
      label: t('settings.agent_tools_category_memory', '记忆工具'),
      icon: <Palette size={18} />
    },
    search: {
      label: t('settings.agent_tools_category_search', '搜索工具'),
      icon: <Globe size={18} />
    },
    general: {
      label: t('settings.agent_tools_category_general', '通用工具'),
      icon: <Puzzle size={18} />
    }
  }
}
