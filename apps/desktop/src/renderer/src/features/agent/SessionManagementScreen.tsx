import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SessionManagementPage, type SessionInfo } from '@baishou/ui/src/web/SessionManagementPage';
import { useSessionStore } from '@baishou/store';

export const SessionManagementScreen: React.FC = () => {
  const navigate = useNavigate();
  const { sessions, fetchSessions, deleteSessions, pinSession } = useSessionStore();

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Map backend Session type to UI SessionInfo
  const uiSessions: SessionInfo[] = sessions.map(s => ({
    id: s.id,
    title: s.title || '新会话',
    assistantName: s.assistantId || '未知助手', // TODO: Join assistant name in DB
    assistantEmoji: '💬',
    messageCount: 0, // TODO: Join message count
    isPinned: s.isPinned,
    updatedAt: new Date(s.updatedAt)
  }));

  return (
    <SessionManagementPage
      sessions={uiSessions}
      onSessionTap={(session) => navigate(`/c/${session.id}`)}
      onDeleteSession={(id) => deleteSessions([id])}
      onDeleteMultiple={(ids) => deleteSessions(ids)}
      onPinToggle={(id) => {
        const s = sessions.find(x => x.id === id);
        if (s) pinSession(id, !s.isPinned);
      }}
      onRename={(id, title) => console.log('Rename TODO:', id, title)}
    />
  );
};
