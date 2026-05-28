import React from 'react'
import { SettingsSection } from '@baishou/ui/native'

type Props = {
  title: string
  description?: string
  children: React.ReactNode
}

/**
 * 设置子页统一外壳（与 StorageScreen / 桌面 glass-panel 分区一致）
 */
export function SettingsSectionShell({ title, description, children }: Props) {
  return (
    <SettingsSection title={title} description={description}>
      {children}
    </SettingsSection>
  )
}
