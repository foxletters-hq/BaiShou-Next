import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SessionManagementPage } from '@baishou/ui';

export const SessionManagementScreen: React.FC = () => {
  const [sessions, setSessions] = useState([]);
  const navigate = useNavigate();
  
  const loadSessions = async () => {
    if (typeof window !== 'undefined' && window.electron) {
      const data = await window.electron.ipcRenderer.invoke('agent:get-sessions');
      setSessions(data || []);
    }
  };
  
  useEffect(() => { loadSessions(); }, []);
  
  return (
    <SessionManagementPage
      sessions={sessions}
      onSessionTap={(_session) => {
        // Navigate to the chat page or session
        navigate(`/agent`);
      }}
      onDeleteSession={async (id) => {
        if (typeof window !== 'undefined' && window.electron) {
          await window.electron.ipcRenderer.invoke('agent:delete-sessions', [id]);
          loadSessions();
        }
      }}
      onDeleteMultiple={async (ids) => {
        if (typeof window !== 'undefined' && window.electron) {
          await window.electron.ipcRenderer.invoke('agent:delete-sessions', ids);
          loadSessions();
        }
      }}
      onPinToggle={async (id) => {
        if (typeof window !== 'undefined' && window.electron) {
          // fetch session to know its exact state, or just call pin toggle if IPC supports it 
          // Assuming agent:pin-session expects id and boolean... if we only have toggle we might need to find it:
          const s = sessions.find((s: any) => s.id === id) as any;
          if (s) {
            await window.electron.ipcRenderer.invoke('agent:pin-session', id, !s.isPinned);
            loadSessions();
          }
        }
      }}
      onRename={async (id, newTitle) => {
        if (typeof window !== 'undefined' && window.electron) {
          await window.electron.ipcRenderer.invoke('agent:update-session-title', id, newTitle);
          loadSessions();
        }
      }}
    />
  );
};
