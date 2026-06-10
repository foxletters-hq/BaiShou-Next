import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { formatAppVersion } from '@baishou/shared'
import { useNativeTheme, useNativeToast, useDialog, Switch, Button } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import type { MobileUpdateCheckResult } from '../../../services/mobile-updater.service'
import { SettingsGroupCard } from './SettingsGroupCard'

export interface UpdateSettingsSectionProps {
  embedded?: boolean
}

export const UpdateSettingsSection: React.FC<UpdateSettingsSectionProps> = ({
  embedded = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady } = useBaishou()
  const [autoCheck, setAutoCheck] = useState(true)
  const [checking, setChecking] = useState(false)
  const [lastResult, setLastResult] = useState<MobileUpdateCheckResult | null>(null)

  useEffect(() => {
    if (!dbReady || !services) return
    services.updaterService
      .getAutoCheck()
      .then(setAutoCheck)
      .catch(() => {})
  }, [dbReady, services])

  const handleToggleAutoCheck = async (value: boolean) => {
    if (!services) return
    setAutoCheck(value)
    await services.updaterService.setAutoCheck(value)
  }

  const handleCheckUpdate = async () => {
    if (!services || !dbReady) return
    setChecking(true)
    try {
      const result = await services.updaterService.checkForUpdates()
      setLastResult(result)

      if (result.status === 'available' && result.releaseUrl) {
        const viewRelease = await dialog.confirm(formatAppVersion(result.latestVersion), {
          title: t('updater.available'),
          confirmText: t('updater.view_release')
        })
        if (viewRelease) {
          services.updaterService.openReleaseUrl(result.releaseUrl).catch((e) => {
            toast.showError(e?.message || String(e))
          })
        }
      } else if (result.status === 'not_available') {
        toast.showInfo(t('updater.not_available'))
      } else if (result.status === 'error') {
        toast.showError(result.error || '')
      }
    } finally {
      setChecking(false)
    }
  }

  const currentVersion = formatAppVersion(services?.updaterService.getCurrentVersion())

  const content = (
    <>
      <View style={[styles.row, { borderColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('updater.current_version')}
        </Text>
        <Text style={[styles.value, { color: colors.textSecondary }]}>{currentVersion}</Text>
      </View>

      {lastResult?.latestVersion && (
        <View style={[styles.row, { borderColor: colors.borderSubtle }]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('updater.latest_version')}
          </Text>
          <Text style={[styles.value, { color: colors.textSecondary }]}>
            {formatAppVersion(lastResult.latestVersion)}
          </Text>
        </View>
      )}

      <View style={[styles.switchRow, { borderColor: colors.borderSubtle }]}>
        <View style={styles.switchText}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('updater.auto_check')}
          </Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {t('updater.auto_check_desc')}
          </Text>
        </View>
        <Switch value={autoCheck} onValueChange={handleToggleAutoCheck} disabled={!dbReady} />
      </View>

      <Button
        variant="primary"
        className="w-full"
        onPress={handleCheckUpdate}
        isLoading={checking}
        isDisabled={!dbReady}
      >
        {t('updater.check')}
      </Button>
    </>
  )

  if (embedded) {
    return <View style={styles.embedded}>{content}</View>
  }

  return (
    <View style={styles.section}>
      <SettingsGroupCard>{content}</SettingsGroupCard>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24
  },
  embedded: {
    paddingHorizontal: 14,
    paddingBottom: 14
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 4
  },
  label: {
    fontSize: 15,
    fontWeight: '600'
  },
  value: {
    fontSize: 15
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    marginBottom: 16
  },
  switchText: {
    flex: 1,
    marginRight: 12
  },
  hint: {
    fontSize: 13,
    marginTop: 4
  }
})
