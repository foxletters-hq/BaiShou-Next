import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AssistantManagementPage, AssistantEditPage } from '@baishou/ui';

export const AssistantManagementScreen: React.FC = () => {
  const [assistants, setAssistants] = useState<any[]>([]);
  const [editingAssistantId, setEditingAssistantId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const navigate = useNavigate();
  
  const loadAssistants = async () => {
    if (typeof window !== 'undefined' && window.electron) {
      const data = await window.electron.ipcRenderer.invoke('agent:get-assistants');
      setAssistants(data || []);
    }
  };
  
  useEffect(() => { loadAssistants(); }, []);

  if (isCreatingNew) {
    return (
      <div style={{ flex: 1, height: '100%', position: 'relative' }}>
        <AssistantEditPage
          assistant={null}
          onSave={async (data) => {
            if (typeof window !== 'undefined' && window.electron) {
              const newId = `ast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
              await window.electron.ipcRenderer.invoke('agent:create-assistant', { ...data, id: newId });
              await loadAssistants();
            }
            setIsCreatingNew(false);
          }}
          onBack={() => setIsCreatingNew(false)}
        />
      </div>
    );
  }

  if (editingAssistantId) {
    const target = assistants.find(a => a.id === editingAssistantId);
    if (target) {
      return (
        <div style={{ flex: 1, height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <AssistantEditPage
            assistant={target}
            onSave={async (data) => {
              if (typeof window !== 'undefined' && window.electron) {
                await window.electron.ipcRenderer.invoke('agent:update-assistant', target.id, data);
                await loadAssistants();
              }
              setEditingAssistantId(null);
            }}
            onBack={() => setEditingAssistantId(null)}
            onDelete={async () => {
              if (typeof window !== 'undefined' && window.electron) {
                await window.electron.ipcRenderer.invoke('agent:delete-assistant', target.id);
                await loadAssistants();
              }
              setEditingAssistantId(null);
            }}
          />
        </div>
      );
    }
  }
  
  return (
    <AssistantManagementPage
      assistants={assistants}
      onCreate={() => setIsCreatingNew(true)}
      onEdit={(assistant) => setEditingAssistantId(assistant.id)}
      onDelete={async (id) => {
        if (typeof window !== 'undefined' && window.electron) {
           await window.electron.ipcRenderer.invoke('agent:delete-assistant', id);
           loadAssistants();
        }
      }}
      pinnedIds={new Set()}
      onTogglePin={async (id) => {
        if (typeof window !== 'undefined' && window.electron) {
           await window.electron.ipcRenderer.invoke('agent:pin-assistant', id, true);
           loadAssistants();
        }
      }}
    />
  );
};

