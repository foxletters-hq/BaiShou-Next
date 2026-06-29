import type { ImageSourcePropType } from 'react-native'
import { MOOD_IDS, normalizeMoodId, type MoodId } from '@baishou/shared'

/** Microsoft Fluent Emoji 3D (MIT) — bundled for offline use */
const FLUENT_MOOD_ASSETS: Record<MoodId, ImageSourcePropType> = {
  Happy: require('../../assets/mood/happy.png'),
  Content: require('../../assets/mood/content.png'),
  Peaceful: require('../../assets/mood/peaceful.png'),
  Excited: require('../../assets/mood/excited.png'),
  Grateful: require('../../assets/mood/grateful.png'),
  Reflective: require('../../assets/mood/reflective.png'),
  Melancholy: require('../../assets/mood/melancholy.png'),
  Anxious: require('../../assets/mood/anxious.png'),
  Glorious: require('../../assets/mood/glorious.png')
}

export function getMoodFluentImageSource(mood?: string | null): ImageSourcePropType | null {
  if (!mood) return null
  const id = normalizeMoodId(mood)
  if (!(MOOD_IDS as readonly string[]).includes(id)) return null
  return FLUENT_MOOD_ASSETS[id as MoodId]
}
