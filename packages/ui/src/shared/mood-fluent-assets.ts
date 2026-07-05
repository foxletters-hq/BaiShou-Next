import { MOOD_IDS, normalizeMoodId, type MoodId } from '@baishou/shared'
import happyIcon from '../assets/mood/happy.png'
import contentIcon from '../assets/mood/content.png'
import peacefulIcon from '../assets/mood/peaceful.png'
import excitedIcon from '../assets/mood/excited.png'
import gratefulIcon from '../assets/mood/grateful.png'
import reflectiveIcon from '../assets/mood/reflective.png'
import melancholyIcon from '../assets/mood/melancholy.png'
import anxiousIcon from '../assets/mood/anxious.png'
import gloriousIcon from '../assets/mood/glorious.png'

/** Microsoft Fluent Emoji 3D (MIT) — desktop / web bundler URLs */
export const MOOD_FLUENT_ICON_SRC: Record<MoodId, string> = {
  Happy: happyIcon,
  Content: contentIcon,
  Peaceful: peacefulIcon,
  Excited: excitedIcon,
  Grateful: gratefulIcon,
  Reflective: reflectiveIcon,
  Melancholy: melancholyIcon,
  Anxious: anxiousIcon,
  Glorious: gloriousIcon
}

export function getMoodFluentIconSrc(mood?: string | null): string | null {
  if (!mood) return null
  const id = normalizeMoodId(mood)
  if (!(MOOD_IDS as readonly string[]).includes(id)) return null
  return MOOD_FLUENT_ICON_SRC[id as MoodId]
}
