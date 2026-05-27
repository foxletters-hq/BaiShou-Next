import React from 'react'
import { View, Text, Switch, StyleSheet, type ViewProps } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

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
  const { colors, tokens } = useNativeTheme()
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
          <Switch
            value={feature.enabled}
            onValueChange={() => handleToggle(feature.id)}
            trackColor={{
              false: colors.borderSubtle,
              true: colors.primaryLight
            }}
            thumbColor={feature.enabled ? colors.primary : colors.bgSurfaceHighest}
          />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  title: {
    fontSize: 18,
    fontWeight: '700'
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  featureInfo: {
    flex: 1,
    marginRight: 16
  },
  featureName: {
    fontSize: 15,
    fontWeight: '600'
  },
  featureDesc: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
  },
  emptyText: {
    fontSize: 14
  }
})
