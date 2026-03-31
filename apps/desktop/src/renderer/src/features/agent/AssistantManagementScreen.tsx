import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AssistantManagementPage, type AssistantInfo } from '@baishou/ui/src/web/AssistantManagementPage';

// Mock data for development
const MOCK_ASSISTANTS: AssistantInfo[] = [
  {
    id: 'a1',
    name: '白守',
    emoji: '🍵',
    description: '你的专属 AI 伙伴，帮助记录人生、整理思绪',
    systemPrompt: '你是白守，一个温暖而智慧的 AI 伙伴...',
    contextWindow: -1,
    isPinned: true,
    modelId: 'gpt-4o',
    providerId: 'openai',
    compressTokenThreshold: 60000,
  },
  {
    id: 'a2',
    name: '代码助手',
    emoji: '💻',
    description: '精通多种编程语言的编程助手',
    systemPrompt: '你是一个专业的编程助手...',
    contextWindow: 20,
    isPinned: false,
    modelId: 'claude-4-sonnet',
    providerId: 'anthropic',
    compressTokenThreshold: 100000,
  },
];

export const AssistantManagementScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <AssistantManagementPage
      assistants={MOCK_ASSISTANTS}
      pinnedIds={new Set(['a1'])}
      onEdit={(a) => navigate(`/assistants/${a.id}/edit`)}
      onCreate={() => navigate('/assistants/new')}
      onDelete={(id) => console.log('Delete assistant:', id)}
      onTogglePin={(id) => console.log('Toggle pin:', id)}
    />
  );
};
