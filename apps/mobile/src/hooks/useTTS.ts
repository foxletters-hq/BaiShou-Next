import { useState, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';
import { useTranslation } from 'react-i18next';
import { useBaishou } from '../providers/BaishouProvider';

export function useTTS() {
  const { t } = useTranslation();
  const { services } = useBaishou();
  const [ttsPlayingMsgId, setTtsPlayingMsgId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const stopTTS = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
    setTtsPlayingMsgId(null);
  }, []);

  const handleTtsReadAloud = useCallback(async (content: string, messageId?: string) => {
    if (!content.trim()) return;

    // 如果正在播放同一条消息，则停止
    if (ttsPlayingMsgId === messageId) {
      await stopTTS();
      return;
    }

    // 停止之前的播放
    await stopTTS();

    try {
      // 获取 TTS 配置
      if (!services) {
        Alert.alert(t('common.error', '错误'), t('agent.tts_service_not_ready', '服务未就绪'));
        return;
      }

      const globalModels = await services.settingsManager.get<any>('global_models');
      const providers = await services.settingsManager.get<any[]>('ai_providers') || [];

      const ttsProviderId = globalModels?.globalTtsProviderId;
      const ttsModelId = globalModels?.globalTtsModelId;

      if (!ttsProviderId || !ttsModelId) {
        Alert.alert(t('agent.tts_not_configured', 'TTS 未配置'), t('agent.tts_configure_hint', '请在设置中配置 TTS 模型'));
        return;
      }

      const providerConfig = providers.find((p: any) => p.id === ttsProviderId);
      if (!providerConfig) {
        Alert.alert(t('common.error', '错误'), t('agent.tts_provider_not_found', 'TTS 提供商未找到'));
        return;
      }

      const apiKey = providerConfig.apiKey;
      const baseUrl = (providerConfig.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
      const ttsEndpoint = `${baseUrl}/audio/speech`;

      // 调用 TTS API
      const response = await fetch(ttsEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: ttsModelId,
          input: content,
          voice: 'alloy',
          response_format: 'mp3',
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error(`[TTS] API error ${response.status}: ${errText}`);
        Alert.alert(t('agent.tts_failed', '语音合成失败'), `API error: ${response.status}`);
        return;
      }

      // 获取音频数据并转为 base64
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      // 播放音频
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mp3;base64,${base64}` },
        { shouldPlay: true }
      );

      soundRef.current = sound;
      if (messageId) setTtsPlayingMsgId(messageId);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setTtsPlayingMsgId(null);
          soundRef.current = null;
        }
      });
    } catch (e: any) {
      console.error('[TTS] Error:', e);
      Alert.alert(t('agent.tts_failed', '语音合成失败'), e.message || 'Unknown error');
      setTtsPlayingMsgId(null);
    }
  }, [ttsPlayingMsgId, services, t, stopTTS]);

  return {
    ttsPlayingMsgId,
    handleTtsReadAloud,
    stopTTS,
  };
}
