import React from 'react'
import { View, Text, StyleSheet, type ViewProps } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Switch } from '../Switch'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export interface FeatureItem {
  id: string
  name: string
  enabled: boolean
  description?: string
}

export interface FeatureSettingsViewProps extends ViewProps {
  features: FeatureItem[]
  onChange: (features: FeatureItem[]) => void
}

export const FeatureSettingsView: React.FC<FeatureSettingsViewProps> = ({
  features,
  onChange,
  style,
  ...props
}) => {
  const { colors } = useNativeTheme()
  const { t } = useTranslation()

  const handleToggle = (id: string) => {
    const updated = features.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f))
    onChange(updated)
  }

  return (
    <View style={[{ flex: 1 }, style]} {...props}>
      <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('feature_settings.title', '功能设置')}
        </Text>
      </View>
      {features.map((feature, index) => (
        <View
          key={feature.id}
          style={[
            styles.featureRow,
            index < features.length - 1 && {
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSubtle
            }
          ]}
        >
          <View style={styles.featureInfo}>
            <Text style={[styles.featureName, { color: colors.textPrimary }]}>{feature.name}</Text>
            {feature.description ? (
              <Text style={[styles.featureDesc, { color: colors.textTertiary }]}>
                {feature.description}
              </Text>
            ) : null}
          </View>
          <Switch value={feature.enabled} onValueChange={() => handleToggle(feature.id)} />
        </View>
      ))}
      {features.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            {t('feature_settings.empty', '暂无功能设置')}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.mdTight,
    borderBottomWidth: 1
  },
  title: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600'
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.mdSnug
  },
  featureInfo: {
    flex: 1,
    marginRight: sharedTokens.spacing.md
  },
  featureName: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '600'
  },
  featureDesc: {
    fontSize: mobileTypography.caption.fontSize,
    marginTop: sharedTokens.spacing.xs,
    lineHeight: 16
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sharedTokens.spacing.xlPlus
  },
  emptyText: {
    fontSize: mobileTypography.secondary.fontSize
  }
})
