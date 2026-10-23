import type { LucideIcon } from 'lucide-react'
import { Cloud, FolderOpen, Languages, Layers, Library, Lock, PawPrint, User } from 'lucide-react'
export const BRAND_BLUE = '#9AD4EA'
export const BRAND_BLUE_DARK = '#5BA8CD'

export const NUM_ONBOARDING_PAGES = 8

export const ONBOARDING_PAGE = {
  LANGUAGE: 0,
  WELCOME: 1,
  PROFILE: 2,
  PHILOSOPHY: 3,
  COMPRESSION: 4,
  STORAGE: 5,
  API: 6,
  PRIVACY: 7
} as const

export const ONBOARDING_BG_GRADIENT: [string, string] = ['#FFFBF5', '#D9EEF8']

export interface SlideTheme {
  iconColor: string
  glowColor: string
  icon: LucideIcon
}

export const SLIDE_THEMES: SlideTheme[] = [
  {
    iconColor: BRAND_BLUE_DARK,
    glowColor: 'rgba(91, 168, 205, 0.2)',
    icon: Languages
  },
  {
    iconColor: BRAND_BLUE,
    glowColor: 'rgba(154, 212, 234, 0.22)',
    icon: PawPrint
  },
  {
    iconColor: '#64B5F6',
    glowColor: 'rgba(100, 181, 246, 0.2)',
    icon: User
  },
  {
    iconColor: '#9B8DC4',
    glowColor: 'rgba(155, 141, 196, 0.2)',
    icon: Library
  },
  {
    iconColor: '#3D8FD9',
    glowColor: 'rgba(61, 143, 217, 0.2)',
    icon: Layers
  },
  {
    iconColor: '#FFB74D',
    glowColor: 'rgba(255, 183, 77, 0.15)',
    icon: FolderOpen
  },
  {
    iconColor: '#90CAF9',
    glowColor: 'rgba(144, 202, 249, 0.15)',
    icon: Cloud
  },
  {
    iconColor: '#81C784',
    glowColor: 'rgba(129, 199, 132, 0.15)',
    icon: Lock
  }
]
