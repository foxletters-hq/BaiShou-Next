import { DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH } from './builtin-assistant-avatars.constants'
import {
  getDefaultLatteAssistantDescription,
  getDefaultLatteAssistantSystemPrompt
} from './latte-assistant-prompt.defaults'

/** 各工作区内置默认伙伴的稳定 ID（与磁盘 JSON 文件名一致） */
export const DEFAULT_LATTE_ASSISTANT_ID = 'default'

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
    contextWindow: 20,
    assistantKind: 'companion'
  }
}
