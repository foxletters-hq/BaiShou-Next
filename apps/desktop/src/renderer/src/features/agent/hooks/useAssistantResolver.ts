import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAssistantStore } from '@baishou/store';

export interface UseAssistantResolverParams {
  sessionId: string | undefined;
  sessions: any[];
}

export interface UseAssistantResolverResult {
  currentAssistant: any;
  activeAssistantId: string | undefined;
}

/**
 * 助手解析 Hook
 *
 * 职责：根据当前会话/URL 参数解析出活跃的助手实体
 */
export function useAssistantResolver(params: UseAssistantResolverParams): UseAssistantResolverResult {
  const { sessionId, sessions } = params;
  const [searchParams] = useSearchParams();
  const { assistants } = useAssistantStore();

  const currentSession = sessions.find((s: any) => s.id === sessionId);

  let activeAssistantId: string | undefined;
  if (!sessionId) {
    activeAssistantId = searchParams.get('assistantId') || undefined;
  } else if (currentSession) {
    activeAssistantId = (currentSession as any).assistantId;
  }

  const currentAssistant = useMemo(() => {
    if (activeAssistantId) {
      return assistants.find(a => String(a.id) === String(activeAssistantId))
        || assistants.find(a => a.isDefault)
        || { id: 'default', name: 'BaiShou (Core)', emoji: '✨' };
    }
    return assistants.find(a => a.isDefault) || { id: 'default', name: 'BaiShou (Core)', emoji: '✨' };
  }, [activeAssistantId, assistants]);

  return { currentAssistant, activeAssistantId };
}
