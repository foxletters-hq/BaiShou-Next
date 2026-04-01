import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AssistantManagementPage } from '@baishou/ui';

export const AssistantManagementScreen: React.FC = () => {
  const [assistants, setAssistants] = useState([]);
  const navigate = useNavigate();
  
  const loadAssistants = async () => {
    if (typeof window !== 'undefined' && window.electron) {
      const data = await window.electron.ipcRenderer.invoke('agent:get-assistants');
      setAssistants(data || []);
    }
  };
  
  useEffect(() => { loadAssistants(); }, []);
  
  return (
    <AssistantManagementPage
      assistants={assistants}
      onCreate={() => navigate('/assistant/new')}
      onEdit={(id) => navigate(`/assistant/${id}`)}
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
