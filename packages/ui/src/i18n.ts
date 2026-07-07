import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Placeholder dictionaries
const resources = {
  en: {
    agent: {
      selectAssistant: 'Select Assistant',
      search: 'Search...',
      noAssistant: 'No assistants found',
      createAssistant: 'Create Assistant',
      current: 'Current',
      systemPrompt: 'System Prompt',
      modelSettings: 'Model Settings',
      memoryManagement: 'Memory Management',
      contextWindow: 'Context Window',
      compressThreshold: 'Compression Threshold',
      selectThis: 'Select this assistant',
      currentAssistant: 'Current Assistant',
      emptyDetail: 'Select an assistant to view details',
      switchModel: 'Switch Model',
      searchModel: 'Search models...',
      noMatchModel: 'No matching models',
      sessions: {
        new_chat: 'New Chat',
        actions: 'Actions',
        pin: 'Pin',
        unpin: 'Unpin',
        rename: 'Rename',
        delete_session: 'Delete Session'
      },
      tools: {
        tool_call: 'Tool Call',
        tool_call_results: '{{count}} Tool calls'
      },
      chat: {
        input_hint: 'Type a message...',
        ai_label: 'AI'
      }
    },
    settings: {
      web_search_mode_off: 'Search Off',
      web_search_mode_tool: 'Deep Search',
      recall_memories: 'Recall Memories'
    },
    common: {
      copied: 'Copied to clipboard'
    }
  },
  zh: {
    agent: {
      selectAssistant: i18n.t('auto.packages.ui.src.i18n.L52', '选择伙伴'),
      search: i18n.t('auto.packages.ui.src.i18n.L53', '搜索...'),
      noAssistant: i18n.t('auto.packages.ui.src.i18n.L54', '没有相关伙伴'),
      createAssistant: i18n.t('auto.packages.ui.src.i18n.L55', '新建伙伴'),
      current: i18n.t('auto.packages.ui.src.i18n.L56', '当前'),
      systemPrompt: i18n.t('auto.packages.ui.src.i18n.L57', '系统提示词'),
      modelSettings: i18n.t('auto.packages.ui.src.i18n.L58', '模型设置'),
      memoryManagement: i18n.t('auto.packages.ui.src.i18n.L59', '上下文窗口管理'),
      contextWindow: i18n.t('auto.packages.ui.src.i18n.L60', '上下文携带 Window'),
      compressThreshold: i18n.t('auto.packages.ui.src.i18n.L61', '启用上下文压缩'),
      selectThis: i18n.t('auto.packages.ui.src.i18n.L62', '选择此伙伴'),
      currentAssistant: i18n.t('auto.packages.ui.src.i18n.L63', '当前伙伴'),
      emptyDetail: i18n.t('auto.packages.ui.src.i18n.L64', '选择一个伙伴查看详情'),
      switchModel: i18n.t('auto.packages.ui.src.i18n.L65', '切换模型'),
      searchModel: i18n.t('auto.packages.ui.src.i18n.L66', '搜索模型...'),
      noMatchModel: i18n.t('auto.packages.ui.src.i18n.L67', '没有匹配的模型'),
      sessions: {
        new_chat: i18n.t('auto.packages.ui.src.i18n.L69', '新对话'),
        actions: i18n.t('auto.packages.ui.src.i18n.L70', '操作'),
        pin: i18n.t('auto.packages.ui.src.i18n.L71', '置顶'),
        unpin: i18n.t('auto.packages.ui.src.i18n.L72', '取消置顶'),
        rename: i18n.t('auto.packages.ui.src.i18n.L73', '重命名'),
        delete_session: i18n.t('auto.packages.ui.src.i18n.L74', '删除会话')
      },
      tools: {
        tool_call: i18n.t('auto.packages.ui.src.i18n.L77', '工具调用'),
        tool_call_results: i18n.t('auto.packages.ui.src.i18n.L78', '调用了 {{count}} 个操作')
      },
      chat: {
        input_hint: i18n.t('auto.packages.ui.src.i18n.L81', '输入消息...'),
        ai_label: i18n.t('auto.packages.ui.src.i18n.L82', 'AI助手')
      }
    },
    settings: {
      web_search_mode_off: i18n.t('auto.packages.ui.src.i18n.L86', '搜索关闭'),
      web_search_mode_tool: i18n.t('auto.packages.ui.src.i18n.L87', '深度搜索'),
      recall_memories: i18n.t('auto.packages.ui.src.i18n.L88', '记忆唤醒')
    },
    aiProviders: {
      siliconflow: i18n.t('auto.packages.ui.src.i18n.L91', '硅基流动'),
      dashscope: i18n.t('auto.packages.ui.src.i18n.L92', '通义千问 (百炼)'),
      doubao: i18n.t('auto.packages.ui.src.i18n.L93', '豆包 (火山引擎)'),
      zhipu: i18n.t('auto.packages.ui.src.i18n.L94', '智谱 AI'),
      stepfun: i18n.t('auto.packages.ui.src.i18n.L95', '阶跃星辰'),
      hunyuan: i18n.t('auto.packages.ui.src.i18n.L96', '腾讯混元'),
      minimax: 'MiniMax',
      vertexai: 'Google Vertex AI',
      vercel: 'Vercel AI Gateway',
      xiaomimimo: i18n.t('auto.packages.ui.src.i18n.L100', '小米 MiMo'),
      opencodego: 'OpenCode Go'
    },
    common: {
      copied: i18n.t('auto.packages.ui.src.i18n.L104', '已复制到剪贴板')
    }
  }
}

i18n.use(initReactI18next).init({
  resources,
  lng: 'zh', // default
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
})

export default i18n
