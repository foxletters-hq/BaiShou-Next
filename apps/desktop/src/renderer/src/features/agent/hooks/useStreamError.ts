import { useRef, useEffect } from 'react';
import { toast } from '@baishou/ui';
import { useTranslation } from 'react-i18next';

/**
 * 流式错误处理 Hook
 *
 * 职责：将流式错误转换为用户可读的 toast 提示
 */
export function useStreamError(error: string | null, isStreaming: boolean): void {
  const { t } = useTranslation();
  const lastToastedErrorRef = useRef<string | null>(null);

  const getLocalizedError = (rawErr: string): string => {
    const lower = rawErr.toLowerCase();
    if (lower.includes('api key expired') || lower.includes('invalid_api_key') || lower.includes('api key not valid')) {
      return t('agent.error.api_key', 'API Key 已过期或无效，请转至模型设置中更新您的密钥。');
    }
    if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('429')) {
      return t('agent.error.rate_limit', '请求过于频繁或超出并发限制，请稍后再试。');
    }
    if (lower.includes('network') || lower.includes('fetch failed') || lower.includes('econnrefused')) {
      return t('agent.error.network', '网络连接失败，请检查您的网络连接或代理设置。');
    }
    if (lower.includes('timeout') || lower.includes('deadline')) {
      return t('agent.error.timeout', '请求响应超时，请重试。');
    }
    if (lower.includes('insufficient_quota') || lower.includes('balance') || lower.includes('payment required')) {
      return t('agent.error.quota', '模型服务商提示账号额度不足。');
    }
    return t('agent.error.unknown', '出错了：{{msg}}', { msg: rawErr });
  };

  useEffect(() => {
    if (error && !isStreaming) {
      if (lastToastedErrorRef.current !== error) {
        lastToastedErrorRef.current = error;
        const title = t('agent.generation_failed', '回复生成失败');
        const detail = getLocalizedError(error);
        toast.showError(`${title}: ${detail}`);
      }
    } else if (!error) {
      lastToastedErrorRef.current = null;
    }
  }, [error, isStreaming]);
}
