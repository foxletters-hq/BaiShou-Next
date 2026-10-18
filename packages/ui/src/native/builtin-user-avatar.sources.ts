import type { ImageSourcePropType } from 'react-native'
import type { BuiltinUserAvatarId } from '@baishou/shared'
import preset6 from '@baishou/shared/assets/images/assistant-presets/assistant-preset-6.jpg'

export const NATIVE_BUILTIN_USER_AVATAR_SOURCES: Record<BuiltinUserAvatarId, ImageSourcePropType> =
  {
    'user-preset-6': preset6 as ImageSourcePropType
  }
