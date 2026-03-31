import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AssistantManagementPage, type AssistantInfo } from '@baishou/ui/src/web/AssistantManagementPage';
import { useAssistantStore } from '@baishou/store';

export const AssistantManagementScreen: React.FC = () => {
  const navigate = useNavigate();
  const { assistants, fetchAssistants, deleteAssistant } = useAssistantStore();
  
  // Local state for pinned items since it might be user preference rather than global DB state
  // Or if we added it to DB, we'd pull it from DB. For now use local state for pinned IDs.
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAssistants();
  }, [fetchAssistants]);

  const uiAssistants: AssistantInfo[] = assistants.map(a => ({
    id: a.id,
    name: a.name,
    emoji: a.emoji || '🤖',
    description: a.description || '自定义助手',
    systemPrompt: a.systemPrompt || '',
    contextWindow: a.contextWindow,
    isPinned: pinnedIds.has(a.id),
    modelId: a.modelId,
    providerId: a.providerId,
    compressTokenThreshold: a.compressTokenThreshold,
  }));

  const handleTogglePin = (id: string) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AssistantManagementPage
      assistants={uiAssistants}
      pinnedIds={pinnedIds}
      onEdit={(a) => navigate(`/settings/assistants/${a.id}/edit`)}
      onCreate={() => navigate('/settings/assistants/new')}
      onDelete={(id) => deleteAssistant(id)}
      onTogglePin={handleTogglePin}
    />
  );
};
