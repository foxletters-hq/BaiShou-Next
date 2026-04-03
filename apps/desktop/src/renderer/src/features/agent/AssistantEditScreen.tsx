import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AssistantEditPage } from '@baishou/ui';

export const AssistantEditScreen: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assistant, setAssistant] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(id !== 'new');
  
  useEffect(() => {
    if (id && id !== 'new') {
      if (typeof window !== 'undefined' && window.electron) {
        window.electron.ipcRenderer.invoke('agent:get-assistants')
          .then((list: any[]) => {
            setAssistant(list.find(a => a.id === id));
          })
          .catch(console.error)
          .finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [id]);
  
  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)' }}>数据神经网同步中...</div>;
  }

  return (
    <AssistantEditPage
      assistant={assistant}
      onSave={async (data) => {
        if (typeof window !== 'undefined' && window.electron) {
          if (id === 'new') {
            await window.electron.ipcRenderer.invoke('agent:create-assistant', data);
          } else {
            await window.electron.ipcRenderer.invoke('agent:update-assistant', id, data);
          }
        }
        navigate(-1);
      }}
      onBack={() => navigate(-1)}
    />
  );
};
