export type MockChatAttachment = {
  id: string;
  filePath: string;
  fileName: string;
  isImage: boolean;
  isPdf: boolean;
  fileSize?: number;
};

export type MockToolInvocation = {
  toolCallId: string;
  toolName: string;
  state: 'partial-call' | 'call' | 'result';
  args: any;
  result?: any;
};

export type MockChatMessage = {
  id: string;
  sessionId: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  timestamp: Date;
  toolName?: string;
  toolCallId?: string;
  attachments?: MockChatAttachment[];
  inputTokens?: number;
  outputTokens?: number;
  costMicros?: number;
  contextMessages?: MockChatMessage[];
  isReasoning?: boolean;
  toolInvocations?: MockToolInvocation[];
};

export const MOCK_MESSAGES: MockChatMessage[] = [
  {
    id: '1',
    sessionId: 'session_1',
    role: 'user',
    content: '你好，能不能帮我写一段 TypeScript 的基础防抖函数？',
    timestamp: new Date(Date.now() - 60000 * 5),
  },
  {
    id: '2',
    sessionId: 'session_1',
    role: 'assistant',
    content: '当然可以，这里是一个基于 TypeScript 的基础防抖（debounce）函数：\n\n```typescript\nexport function debounce<T extends (...args: any[]) => void>(\n  fn: T,\n  delay: number\n): (...args: Parameters<T>) => void {\n  let timer: ReturnType<typeof setTimeout> | null = null;\n  return function (...args: Parameters<T>) {\n    if (timer) clearTimeout(timer);\n    timer = setTimeout(() => {\n      fn(...args);\n    }, delay);\n  };\n}\n```\n\n你可以调整 `delay` 参数来控制触发的频率。',
    timestamp: new Date(Date.now() - 60000 * 4),
    inputTokens: 25,
    outputTokens: 120,
    costMicros: 350,
  },
  {
    id: '3',
    sessionId: 'session_1',
    role: 'user',
    content: '帮我看看这张图片里面的 UI 结构怎么用 React 实现？',
    timestamp: new Date(Date.now() - 60000 * 3),
    attachments: [
      {
        id: 'att_1',
        filePath: '', // Mock empty path
        fileName: 'design-mockup.png',
        isImage: true,
        isPdf: false
      }
    ]
  },
  {
    id: '4',
    sessionId: 'session_1',
    role: 'tool',
    content: '{"result": "发现这是一个包含聊天气泡和输入框的界面"}',
    timestamp: new Date(Date.now() - 60000 * 1),
    toolName: 'vision_analyze',
    toolCallId: 'call_abc123'
  },
  {
    id: '5',
    sessionId: 'session_1',
    role: 'tool',
    content: 'Tool execution failed: Unable to connect to vector database',
    timestamp: new Date(Date.now() - 60000 * 0.5),
    toolName: 'rag_search',
    toolCallId: 'call_abc124'
  },
  {
    id: '6',
    sessionId: 'session_1',
    role: 'assistant',
    content: '图片内容已经识别：\n这是一张关于**聊天界面**的截图，核心包含：\n1. 顶部的导航栏（标题、操作按钮）\n2. 中间的可滚动气泡列表\n3. 位于底部的带有附件上传的输入框。',
    timestamp: new Date(),
    inputTokens: 1540,
    outputTokens: 90,
    costMicros: 2150,
  }
];

export interface MockAgentAssistant {
  id: string;
  name: string;
  description: string;
  emoji: string | null;
  avatarPath: string | null;
  systemPrompt: string;
  contextWindow: number;
  compressTokenThreshold: number;
  compressKeepTurns: number;
  providerId: string | null;
  modelId: string | null;
}

export const MOCK_ASSISTANT: MockAgentAssistant = {
  id: 'assistant_1',
  name: 'BaiShou AI',
  description: '你的智能全能助手',
  emoji: '✨',
  avatarPath: null,
  systemPrompt: 'You are a helpful assistant.',
  contextWindow: 128000,
  compressTokenThreshold: 0,
  compressKeepTurns: 5,
  providerId: 'openai_1',
  modelId: 'gpt-4o'
};

export const MOCK_ASSISTANTS_LIST: MockAgentAssistant[] = [
  MOCK_ASSISTANT,
  {
    id: 'assistant_2',
    name: '代码翻译管家',
    description: '专门将 Flutter 翻译为 React',
    emoji: '💻',
    avatarPath: null,
    systemPrompt: 'Translate Dart into Typescript React.',
    contextWindow: 200000,
    compressTokenThreshold: 8000,
    compressKeepTurns: 20,
    providerId: 'anthropic_1',
    modelId: 'claude-3-opus'
  }
];

export type MockAiProviderModel = {
  id: string;
  name: string;
  type: string;
  models: string[];
  enabledModels: string[];
};

export const MOCK_PROVIDERS: MockAiProviderModel[] = [
  {
    id: 'openai_1',
    name: 'OpenAI',
    type: 'openai',
    models: ['gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o'],
    enabledModels: ['gpt-4-turbo', 'gpt-4o'],
  },
  {
    id: 'anthropic_1',
    name: 'Anthropic',
    type: 'anthropic',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    enabledModels: ['claude-3-opus', 'claude-3-sonnet'],
  },
  {
    id: 'gemini_1',
    name: 'Google Gemini',
    type: 'gemini',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    enabledModels: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  }
];
