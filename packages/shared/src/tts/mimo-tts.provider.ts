import { TtsProvider, TtsSynthesizeRequest, TtsSynthesizeResponse, TtsProviderConfig } from '../types/tts.types';
import { TtsApiError, TtsInvalidResponseError } from './tts.errors';

export class MimoTtsProvider implements TtsProvider {
  readonly id = 'mimo-tts';
  readonly name = '小米 MiMo TTS';

  supportsModel(modelId: string): boolean {
    return modelId.toLowerCase().includes('mimo-v2.5-tts');
  }

  async synthesize(
    request: TtsSynthesizeRequest,
    config: TtsProviderConfig,
  ): Promise<TtsSynthesizeResponse> {
    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const endpoint = `${baseUrl}/chat/completions`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.modelId,
        messages: [
          { role: 'user', content: 'Natural, clear and professional speech style.' },
          { role: 'assistant', content: request.text },
        ],
        audio: {
          format: request.settings.responseFormat || 'wav',
          voice: request.settings.voice || '冰糖',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new TtsApiError(
        `TTS API 调用失败: ${errText}`,
        response.status,
        this.id,
      );
    }

    const resJson = await response.json();
    const base64Audio = resJson.choices?.[0]?.message?.audio?.data;

    if (!base64Audio) {
      throw new TtsInvalidResponseError(this.id);
    }

    return {
      audioBase64: base64Audio,
      format: request.settings.responseFormat || 'wav',
    };
  }
}
