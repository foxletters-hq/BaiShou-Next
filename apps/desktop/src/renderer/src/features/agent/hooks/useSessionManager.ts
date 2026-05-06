import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export interface UseSessionManagerParams {
  currentAssistantId: string | undefined;
  loadSessions?: (reset: boolean) => void;
}

export interface UseSessionManagerResult {
  createAndNavigate: (title: string) => Promise<string | null>;
}

/**
 * 会话管理 Hook
 *
 * 职责：创建新会话并导航到对应路由
 */
export function useSessionManager(params: UseSessionManagerParams): UseSessionManagerResult {
  const { currentAssistantId, loadSessions } = params;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  const createAndNavigate = useCallback(async (title: string): Promise<string | null> => {
    if (typeof window === 'undefined' || !window.electron) return null;
    try {
      const astId = searchParams.get('assistantId') || currentAssistantId || 'default';
      const newTitle = title.trim().substring(0, 10) || t('agent.sessions.newChat', '新对话');
      const newId = await window.electron.ipcRenderer.invoke('agent:create-session', {
        assistantId: astId,
        title: newTitle,
      });
      if (newId) {
        if (loadSessions) loadSessions(true);
        navigate(`/chat/${newId}`, { replace: true });
      }
      return newId;
    } catch (e: any) {
      console.error('[useSessionManager] Create session failed:', e);
      const errMsg = e?.message || e;
      alert(t('agent.error.create_session', '由于系统原因创建会话失败: {{msg}}', { msg: errMsg }));
      return null;
    }
  }, [searchParams, currentAssistantId, loadSessions, navigate, t]);

  return { createAndNavigate };
}
