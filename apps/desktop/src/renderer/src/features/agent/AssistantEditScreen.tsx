import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AssistantEditPage, type AssistantFormData } from '@baishou/ui/src/web/AssistantEditPage';
import { useAssistantStore } from '@baishou/store';

export const AssistantEditScreen: React.FC = () => {
  const navigate = useNavigate();
  const { assistantId } = useParams<{ assistantId: string }>();
  const { assistants, fetchAssistants, createAssistant, updateAssistant, deleteAssistant } = useAssistantStore();

  useEffect(() => {
    // Ensure we have data loaded if opening directly via URL
    if (assistants.length === 0) {
      fetchAssistants();
    }
  }, [assistants.length, fetchAssistants]);

  // If we are editing, map the backend model to ui form data
  const backendModel = assistantId && assistantId !== 'new' ? assistants.find(a => a.id === assistantId) : null;
  const existingData: AssistantFormData | null = backendModel ? {
    id: backendModel.id,
    name: backendModel.name,
    emoji: backendModel.emoji || '',
    description: backendModel.description || '',
    systemPrompt: backendModel.systemPrompt || '',
    contextWindow: backendModel.contextWindow,
    providerId: backendModel.providerId,
    modelId: backendModel.modelId,
    compressTokenThreshold: backendModel.compressTokenThreshold,
    compressKeepTurns: backendModel.compressKeepTurns || 3,
  } : null;

  const handleSave = async (data: AssistantFormData) => {
    if (data.id && assistantId && assistantId !== 'new') {
      await updateAssistant(data.id, data);
    } else {
      await createAssistant({
        id: crypto.randomUUID(), // SDD open question: yes, generating ID in frontend store before sending via IPC
        ...data,
      });
    }
    navigate('/settings/assistants');
  };

  const handleDelete = async () => {
    if (assistantId && assistantId !== 'new') {
      await deleteAssistant(assistantId);
    }
    navigate('/settings/assistants');
  };

  return (
    <AssistantEditPage
      assistant={existingData}
      onSave={handleSave}
      onDelete={handleDelete}
      onBack={() => navigate(-1)}
    />
  );
};
