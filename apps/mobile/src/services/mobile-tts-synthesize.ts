import type { TtsProviderConfig } from '@baishou/ui/native'

export type TtsTestResult =
  | { success: true; audioBase64: string; format: string }
  | { success: false; error: string }

/** 与 useTTS / 桌面 tts:synthesize 一致的试听请求（不播放，仅返回音频） */
export async function synthesizeTtsForTest(
  config: TtsProviderConfig,
  text: string
): Promise<TtsTestResult> {
  const sample = text.trim() || 'Hello'
  const baseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  const modelId = config.modelId
  const isMimoTts = modelId.toLowerCase().includes('mimo-v2.5-tts')

  let response: Response
  if (isMimoTts) {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'user', content: 'Natural, clear and professional speech style.' },
          { role: 'assistant', content: sample }
        ],
        audio: {
          format: config.responseFormat || 'wav',
          voice: config.voice || '冰糖'
        }
      })
    })
  } else {
    response = await fetch(`${baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelId,
        input: sample,
        voice: config.voice || 'alloy',
        speed: config.speed ?? 1,
        response_format: config.responseFormat || 'mp3'
      })
    })
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    return { success: false, error: errText || `HTTP ${response.status}` }
  }

  if (isMimoTts) {
    const resJson = await response.json()
    const base64Audio = resJson.choices?.[0]?.message?.audio?.data
    if (!base64Audio) {
      return { success: false, error: 'No audio in response' }
    }
    return {
      success: true,
      audioBase64: base64Audio,
      format: config.responseFormat || 'wav'
    }
  }

  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)

  return {
    success: true,
    audioBase64: base64,
    format: config.responseFormat || 'mp3'
  }
}
