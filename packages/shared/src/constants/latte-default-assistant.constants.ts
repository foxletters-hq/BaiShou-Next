import { DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH } from './builtin-assistant-avatars.constants'
import {
  DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD,
  DEFAULT_ASSISTANT_CONTEXT_WINDOW
} from './assistant-memory-defaults.constants'
import {
  getDefaultLatteAssistantDescription,
  getDefaultLatteAssistantSystemPrompt
} from './latte-assistant-prompt.defaults'

/** 各工作区内置默认伙伴的稳定 ID（与磁盘 JSON 文件名一致；遗留） */
export const DEFAULT_LATTE_ASSISTANT_ID = 'default'

/**
 * 系统特殊伙伴 Latte 的稳定 ID（新版本创建；升级时只新建、不改写旧伙伴）。
 * 与 {@link DEFAULT_LATTE_ASSISTANT_ID} 脱钩。
 */
export const SYSTEM_LATTE_ASSISTANT_ID = 'latte'

export const LATTE_ASSISTANT_NAME = 'Latte'

/** @deprecated 请使用 {@link getDefaultLatteAssistantDescription} */
export const LATTE_ASSISTANT_DESCRIPTION = getDefaultLatteAssistantDescription('zh')

/** @deprecated 请使用 {@link getDefaultLatteAssistantSystemPrompt} */
export const LATTE_ASSISTANT_SYSTEM_PROMPT = getDefaultLatteAssistantSystemPrompt('zh')

/** 曾用于内置默认助手的旧名称（用于无损升级到 Latte） */
export const LEGACY_DEFAULT_ASSISTANT_NAMES = [
  '默认伙伴',
  'Default Companion',
  'Default Assistant',
  '預設夥伴',
  '默認夥伴',
  'デフォルトパートナー',
  'デフォルトアシスタント'
] as const

export type DefaultLatteAssistantSeed = {
  name: string
  description: string
  avatarPath: string
  systemPrompt: string
  isDefault: true
  isPinned: false
  contextWindow: number
  compressTokenThreshold: number
  assistantKind: 'companion'
}

export function getDefaultLatteAssistantSeed(locale?: string): DefaultLatteAssistantSeed {
  return {
    name: LATTE_ASSISTANT_NAME,
    description: getDefaultLatteAssistantDescription(locale),
    avatarPath: DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH,
    systemPrompt: getDefaultLatteAssistantSystemPrompt(locale),
    isDefault: true,
    isPinned: false,
    contextWindow: DEFAULT_ASSISTANT_CONTEXT_WINDOW,
    compressTokenThreshold: DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD,
    assistantKind: 'companion'
  }
}

/** 系统 Latte 种子；isDefault 由 ensure 按仓状态决定，此处默认 false */
export type SystemLatteAssistantSeed = {
  name: string
  description: string
  avatarPath: string
  systemPrompt: string
  customSystemPrompt: string
  isDefault: false
  isPinned: false
  contextWindow: number
  compressTokenThreshold: number
  assistantKind: 'companion'
}

export function getSystemLatteAssistantSeed(locale?: string): SystemLatteAssistantSeed {
  return {
    name: LATTE_ASSISTANT_NAME,
    description: getDefaultLatteAssistantDescription(locale),
    avatarPath: DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH,
    systemPrompt: getDefaultLatteAssistantSystemPrompt(locale),
    customSystemPrompt: '',
    isDefault: false,
    isPinned: false,
    contextWindow: DEFAULT_ASSISTANT_CONTEXT_WINDOW,
    compressTokenThreshold: DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD,
    assistantKind: 'companion'
  }
}

export function isSystemLatteAssistantId(id: string | null | undefined): boolean {
  return id === SYSTEM_LATTE_ASSISTANT_ID
}

/** Core / IPC：禁止删除系统 Latte 时的稳定错误码 */
export const SYSTEM_LATTE_ASSISTANT_CANNOT_DELETE = 'SYSTEM_LATTE_ASSISTANT_CANNOT_DELETE'
