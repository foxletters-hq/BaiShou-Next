import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AssistantEditPage, type AssistantFormData } from '@baishou/ui/src/web/AssistantEditPage';

// Find mock data — in production this comes from store/DB
const MOCK_DATA: Record<string, AssistantFormData> = {
  a1: {
    id: 'a1',
    name: '白守',
    emoji: '🍵',
    description: '你的专属 AI 伙伴',
    systemPrompt: '你是白守，一个温暖而智慧的 AI 伙伴...',
    contextWindow: -1,
    providerId: 'openai',
    modelId: 'gpt-4o',
    compressTokenThreshold: 60000,
    compressKeepTurns: 3,
  },
};

export const AssistantEditScreen: React.FC = () => {
  const navigate = useNavigate();
  const { assistantId } = useParams();

  const existingData = assistantId ? MOCK_DATA[assistantId] ?? null : null;

  return (
    <AssistantEditPage
      assistant={existingData}
      onSave={(data) => {
        console.log('Save assistant:', data);
        navigate('/assistants');
      }}
      onDelete={() => {
        console.log('Delete assistant:', assistantId);
        navigate('/assistants');
      }}
      onBack={() => navigate(-1)}
    />
  );
};
