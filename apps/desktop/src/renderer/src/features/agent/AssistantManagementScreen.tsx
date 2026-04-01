import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AssistantManagementPage, type AssistantInfo } from '@baishou/ui';
import { useAssistantStore } from '@baishou/store';

export const AssistantManagementScreen: React.FC = () => {
  const navigate = useNavigate();
  const { assistants, fetchAssistants, deleteAssistant, createAssistant } = useAssistantStore();
  
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAssistants();
  }, [fetchAssistants]);

  const uiAssistants: AssistantInfo[] = assistants.map((a, idx) => ({
    id: a.id,
    name: a.name,
    emoji: a.emoji || '🤖',
    description: a.description || '',
    systemPrompt: a.systemPrompt || '',
    contextWindow: a.contextWindow,
    isPinned: pinnedIds.has(a.id),
    modelId: a.modelId,
    providerId: a.providerId,
    compressTokenThreshold: a.compressTokenThreshold,
    // 注入假随机时序数据以支持 Vibe 管理面板的前端排序展示流
    createdAt: Date.now() - (idx * 3600000), 
    useCount: Math.floor(Math.random() * 150)
  }));

  const handleTogglePin = (id: string) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClone = async (assistant: AssistantInfo) => {
    // 走一遍 deep copy 发去底层的创建指令
    await createAssistant({
      id: crypto.randomUUID(),
      name: `${assistant.name} (Clone)`,
      emoji: assistant.emoji,
      description: assistant.description,
      systemPrompt: assistant.systemPrompt,
      contextWindow: assistant.contextWindow,
      providerId: assistant.providerId || '',
      modelId: assistant.modelId || '',
      compressTokenThreshold: assistant.compressTokenThreshold,
      compressKeepTurns: 3
    });
  };

  return (
    <AssistantManagementPage
      assistants={uiAssistants}
      pinnedIds={pinnedIds}
      onEdit={(a) => navigate(`/settings/assistants/${a.id}/edit`)}
      onCreate={() => navigate('/settings/assistants/new')}
      onDelete={(id) => deleteAssistant(id)}
      onClone={handleClone}
      onTogglePin={handleTogglePin}
    />
  );
};
