import type { IconType } from 'react-icons'
import {
  MdPets,
  MdAutoStories,
  MdLayers,
  MdFolderOpen,
  MdCloud,
  MdLock,
  MdLanguage
} from 'react-icons/md'

export const BRAND_BLUE = '#9AD4EA'
export const BRAND_BLUE_DARK = '#5BA8CD'

export const NUM_ONBOARDING_PAGES = 7

export const ONBOARDING_PAGE = {
  LANGUAGE: 0,
  WELCOME: 1,
  PHILOSOPHY: 2,
  COMPRESSION: 3,
  STORAGE: 4,
  API: 5,
  PRIVACY: 6
} as const

export const ONBOARDING_BG_GRADIENT: [string, string] = ['#FFFBF5', '#D9EEF8']

export interface SlideTheme {
  iconColor: string
  glowColor: string
  icon: IconType
}

export const SLIDE_THEMES: SlideTheme[] = [
  {
    iconColor: BRAND_BLUE_DARK,
    glowColor: 'rgba(91, 168, 205, 0.2)',
    icon: MdLanguage
  },
  {
    iconColor: BRAND_BLUE,
    glowColor: 'rgba(154, 212, 234, 0.22)',
    icon: MdPets
  },
  {
    iconColor: '#9B8DC4',
    glowColor: 'rgba(155, 141, 196, 0.2)',
    icon: MdAutoStories
  },
  {
    iconColor: '#3D8FD9',
    glowColor: 'rgba(61, 143, 217, 0.2)',
    icon: MdLayers
  },
  {
    iconColor: '#FFB74D',
    glowColor: 'rgba(255, 183, 77, 0.15)',
    icon: MdFolderOpen
  },
  {
    iconColor: '#90CAF9',
    glowColor: 'rgba(144, 202, 249, 0.15)',
    icon: MdCloud
  },
  {
    iconColor: '#81C784',
    glowColor: 'rgba(129, 199, 132, 0.15)',
    icon: MdLock
  }
]
