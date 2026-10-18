import type { ImageSourcePropType } from 'react-native'
import type { BuiltinAssistantAvatarId } from '@baishou/shared'
import preset6 from '@baishou/shared/assets/images/assistant-presets/assistant-preset-6.jpg'

export const NATIVE_BUILTIN_ASSISTANT_AVATAR_SOURCES: Record<
  BuiltinAssistantAvatarId,
  ImageSourcePropType
> = {
  'assistant-preset-6': preset6 as ImageSourcePropType
}
