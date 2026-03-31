import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SessionManagementPage, type SessionInfo } from '@baishou/ui/src/web/SessionManagementPage';

// Mock data for development
const MOCK_SESSIONS: SessionInfo[] = [
  {
    id: 's1',
    title: 'React Hooks 原理讨论',
    assistantName: '白守',
    assistantEmoji: '🍵',
    messageCount: 24,
    isPinned: true,
    updatedAt: new Date(),
  },
  {
    id: 's2',
    title: 'TypeScript 严格模式配置',
    assistantName: '代码助手',
    assistantEmoji: '💻',
    messageCount: 12,
    isPinned: false,
    updatedAt: new Date(Date.now() - 86400000),
  },
  {
    id: 's3',
    title: '白守 Next 架构设计',
    assistantName: '白守',
    assistantEmoji: '🍵',
    messageCount: 56,
    isPinned: false,
    updatedAt: new Date(Date.now() - 172800000),
  },
];

export const SessionManagementScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SessionManagementPage
      sessions={MOCK_SESSIONS}
      onSessionTap={(session) => navigate(`/c/${session.id}`)}
      onDeleteSession={(id) => console.log('Delete session:', id)}
      onDeleteMultiple={(ids) => console.log('Delete multiple:', ids)}
      onPinToggle={(id) => console.log('Toggle pin:', id)}
      onRename={(id, title) => console.log('Rename:', id, title)}
    />
  );
};
