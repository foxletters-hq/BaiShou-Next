/**
 * 白守统一日志工具
 * 
 * 替代裸 console.log，提供分级日志能力。
 * 后续可无缝替换为 pino 或其他结构化日志库。
 */

type LogMeta = Record<string, unknown> | string | number | Error;

interface Logger {
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
  debug(message: string, meta?: LogMeta): void;
}

function formatMeta(meta?: LogMeta): unknown[] {
  if (meta === undefined) return [];
  if (meta instanceof Error) return [meta];
  if (typeof meta === 'object') return [meta];
  return [meta];
}

export const logger: Logger = {
  info(message: string, meta?: LogMeta) {
    console.log(`[INFO] ${message}`, ...formatMeta(meta));
  },
  warn(message: string, meta?: LogMeta) {
    console.warn(`[WARN] ${message}`, ...formatMeta(meta));
  },
  error(message: string, meta?: LogMeta) {
    console.error(`[ERROR] ${message}`, ...formatMeta(meta));
  },
  debug(message: string, meta?: LogMeta) {
    console.debug(`[DEBUG] ${message}`, ...formatMeta(meta));
  },
};
