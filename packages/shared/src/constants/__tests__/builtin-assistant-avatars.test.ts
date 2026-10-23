import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DEFAULT_ASSISTANT_AVATAR_PATH } from '../app-brand.constants'
import {
  BUILTIN_ASSISTANT_AVATAR_IDS,
  DEFAULT_BUILTIN_ASSISTANT_AVATAR_ID,
  DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH,
  getBuiltinAssistantAvatarAssetRelativePath,
  isBuiltinAssistantAvatarPath,
  parseBuiltinAssistantAvatarId
} from '../builtin-assistant-avatars.constants'

const here = dirname(fileURLToPath(import.meta.url))
const presetsDir = join(here, '../../../assets/images/assistant-presets')

describe('builtin assistant avatars', () => {
  it('should use the blue-sky Latte portrait as the default builtin avatar', () => {
    expect(DEFAULT_BUILTIN_ASSISTANT_AVATAR_ID).toBe('assistant-preset-6')
    expect(BUILTIN_ASSISTANT_AVATAR_IDS[0]).toBe('assistant-preset-6')
    expect(DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH).toBe('builtin-assistant:assistant-preset-6')
    expect(DEFAULT_ASSISTANT_AVATAR_PATH).toBe(
      getBuiltinAssistantAvatarAssetRelativePath('assistant-preset-6')
    )
  })

  it('should keep the default portrait file in shared assistant presets', () => {
    const file = join(presetsDir, 'assistant-preset-6.jpg')
    expect(existsSync(file)).toBe(true)
    const bytes = readFileSync(file)
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]))
  })

  it('correctly identifies and parses builtin assistant avatars with cross-compatibility', () => {
    expect(BUILTIN_ASSISTANT_AVATAR_IDS).toEqual(['assistant-preset-6'])
    expect(isBuiltinAssistantAvatarPath('builtin-assistant:assistant-preset-6')).toBe(true)
    expect(isBuiltinAssistantAvatarPath('builtin-user:user-preset-6')).toBe(true)
    expect(isBuiltinAssistantAvatarPath('avatars/custom.png')).toBe(false)
    expect(isBuiltinAssistantAvatarPath(null)).toBe(false)

    expect(parseBuiltinAssistantAvatarId('builtin-assistant:assistant-preset-6')).toBe(
      'assistant-preset-6'
    )
    expect(parseBuiltinAssistantAvatarId('builtin-assistant:assistant-preset-1')).toBe(
      'assistant-preset-6'
    )
    expect(parseBuiltinAssistantAvatarId('builtin-user:user-preset-6')).toBe('assistant-preset-6')
    expect(parseBuiltinAssistantAvatarId('avatars/custom.png')).toBe(null)
  })
})
