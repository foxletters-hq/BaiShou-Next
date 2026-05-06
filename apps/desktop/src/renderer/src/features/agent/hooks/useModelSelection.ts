import { useState, useRef, useEffect } from 'react';
import { useSettingsStore } from '@baishou/store';

export interface UseModelSelectionParams {
  sessionId: string | undefined;
  currentAssistant: any;
}

export interface UseModelSelectionResult {
  currentProviderId: string;
  currentModelId: string;
  setCurrentProviderId: (id: string) => void;
  setCurrentModelId: (id: string) => void;
  userManuallySetModelRef: React.MutableRefObject<boolean>;
}

/**
 * 模型选择 Hook
 *
 * 职责：
 * 1. 根据助手/全局设置推导默认模型
 * 2. 支持用户手动切换模型
 * 3. 会话切换时重置手动标记
 */
export function useModelSelection(params: UseModelSelectionParams): UseModelSelectionResult {
  const { sessionId, currentAssistant } = params;
  const settings = useSettingsStore();

  const providers = settings?.providers || [];
  const fallbackProvider = providers.length > 0 ? providers[0] : null;
  const fallbackModelId = fallbackProvider?.enabledModels?.[0] || fallbackProvider?.models?.[0]?.id || 'unknown';
  const fallbackProviderId = fallbackProvider?.providerId || 'unknown';

  let defaultProviderInfo = fallbackProviderId;
  let defaultModelInfo = fallbackModelId;

  if (settings.globalModels?.globalDialogueProviderId && settings.globalModels?.globalDialogueModelId) {
    defaultProviderInfo = settings.globalModels.globalDialogueProviderId;
    defaultModelInfo = settings.globalModels.globalDialogueModelId;
  }

  const [currentProviderId, setCurrentProviderId] = useState<string>(defaultProviderInfo);
  const [currentModelId, setCurrentModelId] = useState<string>(defaultModelInfo);
  const userManuallySetModelRef = useRef<boolean>(false);
  const prevSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      userManuallySetModelRef.current = false;
      prevSessionIdRef.current = sessionId || null;
    }

    if (userManuallySetModelRef.current) return;

    const assistantProviderId = (currentAssistant as any)?.providerId;
    const assistantModelId = (currentAssistant as any)?.modelId;

    let baseProviderId = fallbackProviderId;
    let baseModelId = fallbackModelId;

    if (assistantProviderId && assistantModelId && assistantProviderId !== 'unknown' && assistantModelId !== 'unknown') {
      baseProviderId = assistantProviderId;
      baseModelId = assistantModelId;
    } else if (
      settings.globalModels?.globalDialogueProviderId &&
      settings.globalModels?.globalDialogueModelId &&
      settings.globalModels.globalDialogueProviderId !== 'unknown' &&
      settings.globalModels.globalDialogueModelId !== 'unknown'
    ) {
      baseProviderId = settings.globalModels.globalDialogueProviderId;
      baseModelId = settings.globalModels.globalDialogueModelId;
    }

    if (baseModelId && baseModelId !== 'unknown' && baseProviderId && baseProviderId !== 'unknown') {
      setCurrentProviderId(baseProviderId);
      setCurrentModelId(baseModelId);
    }
  }, [sessionId, currentAssistant, settings.globalModels, fallbackProviderId, fallbackModelId]);

  return {
    currentProviderId,
    currentModelId,
    setCurrentProviderId,
    setCurrentModelId,
    userManuallySetModelRef,
  };
}
