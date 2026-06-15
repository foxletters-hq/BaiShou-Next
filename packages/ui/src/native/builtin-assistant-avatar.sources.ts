import type { ImageSourcePropType } from 'react-native'
import type { BuiltinAssistantAvatarId } from '@baishou/shared'

export const NATIVE_BUILTIN_ASSISTANT_AVATAR_SOURCES: Record<
  BuiltinAssistantAvatarId,
  ImageSourcePropType
> = {
  'assistant-preset-1': require('@baishou/shared/assets/images/assistant-presets/assistant-preset-1.jpg'),
  'assistant-preset-2': require('@baishou/shared/assets/images/assistant-presets/assistant-preset-2.jpg'),
  'assistant-preset-3': require('@baishou/shared/assets/images/assistant-presets/assistant-preset-3.jpg'),
  'assistant-preset-4': require('@baishou/shared/assets/images/assistant-presets/assistant-preset-4.jpg'),
  'assistant-preset-5': require('@baishou/shared/assets/images/assistant-presets/assistant-preset-5.jpg')
}
