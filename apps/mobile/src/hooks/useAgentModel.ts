import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useBaishou } from '../providers/BaishouProvider';

// 助手接口
interface Assistant {
  id: string;
  name: string;
  emoji: string;
  isDefault: boolean;
  isPinned: boolean;
  systemPrompt?: string;
  providerId?: string;
  modelId?: string;
}

export function useAgentModel() {
  const { t } = useTranslation();
  const { services, dbReady } = useBaishou();

  // 助手管理状态
  const [currentAssistant, setCurrentAssistant] = useState<Assistant | null>(null);
  const [showAssistantPicker, setShowAssistantPicker] = useState(false);

  // 模型管理状态
  const [currentProviderId, setCurrentProviderId] = useState<string | null>(null);
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  const [showModelSwitcher, setShowModelSwitcher] = useState(false);

  // 加载默认助手和模型配置
  useEffect(() => {
    if (!dbReady || !services) return;

    const loadDefaultConfig = async () => {
      try {
        // 加载助手列表
        const assistants = await services.settingsManager.get<Assistant[]>('assistants') || [];
        const defaultAssistant = assistants.find(a => a.isDefault) || assistants[0];
        if (defaultAssistant) {
          setCurrentAssistant(defaultAssistant);
        }

        // 加载模型配置
        const globalModels = await services.settingsManager.get<any>('global_models');
        if (globalModels) {
          setCurrentProviderId(globalModels.globalDialogueProviderId);
          setCurrentModelId(globalModels.globalDialogueModelId);
        }
      } catch (e) {
        console.warn('Failed to load default config', e);
      }
    };

    loadDefaultConfig();
  }, [dbReady, services]);

  // 选择助手
  const handleSelectAssistant = useCallback((assistant: Assistant) => {
    setCurrentAssistant(assistant);
    setShowAssistantPicker(false);

    // 如果助手有自己的模型配置，使用助手的配置
    if (assistant.providerId) {
      setCurrentProviderId(assistant.providerId);
    }
    if (assistant.modelId) {
      setCurrentModelId(assistant.modelId);
    }
  }, []);

  // 选择模型
  const handleSelectModel = useCallback((providerId: string, modelId: string) => {
    setCurrentProviderId(providerId);
    setCurrentModelId(modelId);
    setShowModelSwitcher(false);
  }, []);

  // 获取有效的模型配置（助手优先）
  const getEffectiveModelConfig = useCallback(() => {
    // 助手级模型优先
    if (currentAssistant?.providerId && currentAssistant?.modelId) {
      return {
        providerId: currentAssistant.providerId,
        modelId: currentAssistant.modelId,
      };
    }
    // 否则使用全局配置
    return {
      providerId: currentProviderId,
      modelId: currentModelId,
    };
  }, [currentAssistant, currentProviderId, currentModelId]);

  return {
    // 状态
    currentAssistant,
    currentProviderId,
    currentModelId,
    showAssistantPicker,
    showModelSwitcher,
    // 方法
    setCurrentAssistant,
    setCurrentProviderId,
    setCurrentModelId,
    setShowAssistantPicker,
    setShowModelSwitcher,
    handleSelectAssistant,
    handleSelectModel,
    getEffectiveModelConfig,
  };
}
