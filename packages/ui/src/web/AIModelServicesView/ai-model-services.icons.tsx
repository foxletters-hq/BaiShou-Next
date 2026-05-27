import React from 'react'
import { MdCloud } from 'react-icons/md'
import styles from './AIModelServicesView.module.css'
import { BASE_KNOWN_PROVIDERS_CONFIG } from './ai-model-services.constants'
import { getProviderIcon } from '../../utils/provider-icons'

export function renderProviderIcon(iconUrl?: string) {
  return iconUrl ? (
    <img src={iconUrl} alt="icon" className={styles.providerIconImage} />
  ) : (
    <MdCloud className={styles.providerIconFallback} />
  )
}

export function renderProviderTypeIcon(typeId: string, isDark = false) {
  const meta = BASE_KNOWN_PROVIDERS_CONFIG.find((p) => p.id === typeId)
  const iconUrl = meta ? getProviderIcon(meta.id, isDark) : undefined
  return iconUrl ? (
    <img src={iconUrl} className={styles.modalTypeIcon} alt="" />
  ) : (
    <MdCloud className={styles.modalTypeFallback} />
  )
}
