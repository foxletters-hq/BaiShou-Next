import React from 'react'
import styles from './AIModelServicesView.module.css'
import { BASE_KNOWN_PROVIDERS_CONFIG } from './ai-model-services.constants'
import { getProviderIcon } from '../../utils/provider-icons'
import { Cloud } from 'lucide-react'

export function renderProviderIcon(iconUrl?: string) {
  return iconUrl ? (
    <img src={iconUrl} alt="icon" className={styles.providerIconImage} />
  ) : (
    <Cloud className={styles.providerIconFallback} />
  )
}

export function renderProviderTypeIcon(typeId: string, isDark = false) {
  const meta = BASE_KNOWN_PROVIDERS_CONFIG.find((p) => p.id === typeId)
  const iconUrl = meta ? getProviderIcon(meta.id, isDark) : undefined
  return iconUrl ? (
    <img src={iconUrl} className={styles.modalTypeIcon} alt="" />
  ) : (
    <Cloud className={styles.modalTypeFallback} />
  )
}
