import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

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
      selectAssistant: '选择伙伴',
      search: '搜索...',
      noAssistant: '没有相关伙伴',
      createAssistant: '新建伙伴',
      current: '当前',
      systemPrompt: '系统提示词',
      modelSettings: '模型设置',
      memoryManagement: '上下文窗口管理',
      contextWindow: '上下文携带 Window',
      compressThreshold: '启用上下文压缩',
      selectThis: '选择此伙伴',
      currentAssistant: '当前伙伴',
      emptyDetail: '选择一个伙伴查看详情',
      switchModel: '切换模型',
      searchModel: '搜索模型...',
      noMatchModel: '没有匹配的模型',
      sessions: {
        new_chat: '新对话',
        actions: '操作',
        pin: '置顶',
        unpin: '取消置顶',
        rename: '重命名',
        delete_session: '删除会话'
      },
      tools: {
        tool_call: '工具调用',
        tool_call_results: '调用了 {{count}} 个操作'
      },
      chat: {
        input_hint: '输入消息...',
        ai_label: 'AI助手'
      }
    },
    settings: {
      web_search_mode_off: '搜索关闭',
      web_search_mode_tool: '深度搜索',
      recall_memories: '记忆唤醒'
    },
    aiProviders: {
      siliconflow: '硅基流动',
      dashscope: '通义千问 (百炼)',
      doubao: '豆包 (火山引擎)',
      zhipu: '智谱 AI',
      stepfun: '阶跃星辰',
      hunyuan: '腾讯混元',
      minimax: 'MiniMax',
      vertexai: 'Google Vertex AI',
      vercel: 'Vercel AI Gateway',
      xiaomimimo: '小米 MiMo',
    },
    common: {
      copied: '已复制到剪贴板'
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'zh', // default
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
