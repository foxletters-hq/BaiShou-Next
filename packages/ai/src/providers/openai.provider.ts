import { createOpenAI } from '@ai-sdk/openai';
import { LanguageModel, EmbeddingModel, generateText } from 'ai';
import { AiProviderModel } from '@baishou/shared';
import { IAIProvider } from './provider.interface';
import { getRotatedApiKey } from './provider.utils';

/**
 * DeepSeek thinking 模式的双向拦截器：
 *
 * 【响应方向】@ai-sdk/openai 的 openaiChatChunkSchema 未定义 reasoning_content 字段，
 *   导致 Zod 校验时丢弃 DeepSeek 返回的推理内容。本拦截器在 SSE 流中将 reasoning_content
 *   注入到 content 字段（以 <think> 标签包裹），确保 SDK 能捕获推理文本。
 *
 * 【请求方向】将 assistant 消息中的 <think> 标签提取为独立的 reasoning_content 字段，
 *   满足 DeepSeek API 多轮对话中必须回传推理内容的要求。
 *
 * 同时缓存当次响应的 reasoning_content，供后续请求回传。
 */
function createDeepSeekFetchInterceptor(baseURL?: string) {
  const isDeepSeek = baseURL?.includes('deepseek');

  return async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!isDeepSeek) {
      return fetch(url, init);
    }

    const urlStr = typeof url === 'string' ? url : url.toString();
    if (!urlStr.includes('/chat/completions')) {
      return fetch(url, init);
    }

    // 请求方向：提取 <think> → reasoning_content
    if (init?.body && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        if (body.messages && Array.isArray(body.messages)) {
          for (const msg of body.messages) {
            if (msg.role !== 'assistant' || typeof msg.content !== 'string' || !msg.content) {
              continue;
            }
            const thinkMatch = msg.content.match(/<think>\s*([\s\S]*?)\s*<\/think>/);
            if (thinkMatch) {
              const reasoningContent = thinkMatch[1].trim();
              msg.content = msg.content.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
              msg.reasoning_content = reasoningContent;
            }
          }
          init.body = JSON.stringify(body);
        }
      } catch {
        // 解析失败则不干预
      }
    }

    const response = await fetch(url, init);

    if (!response.ok || !response.body) {
      return response;
    }

    // 响应方向：拦截 SSE 流，将 reasoning_content 注入到 content 字段
    // 使用 ReadableStream 逐行处理，不破坏流式传输
    const originalReader = response.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = '';

    const transformedStream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await originalReader.read();
        if (done) {
          if (buffer) {
            const transformed = transformSSELine(buffer);
            controller.enqueue(encoder.encode(transformed));
          }
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // 最后一行可能不完整，保留在 buffer 中
        buffer = lines.pop() || '';

        for (const line of lines) {
          const transformed = transformSSELine(line);
          controller.enqueue(encoder.encode(transformed + '\n'));
        }
      },
    });

    return new Response(transformedStream, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

/**
 * 转换单行 SSE 数据：将 delta.reasoning_content 注入到 delta.content 中。
 */
function transformSSELine(line: string): string {
  if (!line.startsWith('data: ') || line === 'data: [DONE]') {
    return line;
  }
  try {
    const data = JSON.parse(line.slice(6));
    const delta = data?.choices?.[0]?.delta;
    if (delta?.reasoning_content) {
      delta.content = `<think>${delta.reasoning_content}</think>`;
      return `data: ${JSON.stringify(data)}`;
    }
  } catch {
    // 非 JSON 行，原样返回
  }
  return line;
}

/**
 * 通用的兼容 OpenAI 标准 API 格式的 Provider
 * 根据传入配置动态替换 BaseUrl 与 ApiKey
 */
export class OpenAIAdaptedProvider implements IAIProvider {
  public config: AiProviderModel;
  constructor(config: AiProviderModel) {
    this.config = config;
  }

  private _getSdk() {
    const rotatedKey = getRotatedApiKey(this.config);
    const baseURL = this.config.baseUrl || undefined;
    return createOpenAI({
      apiKey: rotatedKey || this.config.apiKey,
      baseURL,
      fetch: createDeepSeekFetchInterceptor(baseURL),
    });
  }

  getLanguageModel(modelId?: string): LanguageModel {
    const targetModel = modelId || this.config.defaultDialogueModel || 'gpt-4o';
    // Use .chat() to ensure we hit /v1/chat/completions instead of the new Responses API (/v1/responses)
    return this._getSdk().chat(targetModel) as unknown as LanguageModel;
  }

  getEmbeddingModel(modelId?: string): EmbeddingModel {
    const targetModel = modelId || 'text-embedding-3-small';
    return this._getSdk().textEmbeddingModel(targetModel) as unknown as EmbeddingModel;
  }

  async fetchAvailableModels(): Promise<string[]> {
    // OpenAI 原生的模型拉取端点。
    // 这里因为 AI SDK 屏蔽了该接口，我们可以使用基础的 fetch 调用
    const apiKey = getRotatedApiKey(this.config) || this.config.apiKey;
    if (!apiKey && this.config.type !== 'ollama' && this.config.type !== 'lmstudio') {
      return [];
    }

    const endpoint = this.config.baseUrl ? this.config.baseUrl.replace(/\/$/, '') + '/models' : 'https://api.openai.com/v1/models';
    
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (data && data.data && Array.isArray(data.data)) {
        return data.data.map((m: any) => m.id);
      }
      throw new Error(`Invalid response format from API. Expected data array.`);
    } catch (e: any) {
      console.error(`Fetch models error for ${this.config.name}:`, e);
      throw new Error(e.message || 'Unknown network error');
    }
  }

  async testConnection(testModelId?: string): Promise<void> {
    const modelToTest = testModelId || 
      this.config.defaultDialogueModel || 
      (this.config.enabledModels && this.config.enabledModels.length > 0 ? this.config.enabledModels[0] : null) ||
      (this.config.models && this.config.models.length > 0 ? this.config.models[0] : null);

    if (!modelToTest) {
      throw new Error('No usable model found. Please fetch models first.');
    }

    try {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort('Connection timeout'), 15000);

      await generateText({
        model: this.getLanguageModel(modelToTest),
        prompt: 'test',
        maxOutputTokens: 1,
        abortSignal: abortController.signal,
      });

      clearTimeout(timeoutId);
    } catch (e: any) {
      console.error(`Test connection error for ${this.config.name}:`, e);
      throw new Error(`Connection test failed: ${e.message || 'Unknown network error'}`);
    }
  }
}
