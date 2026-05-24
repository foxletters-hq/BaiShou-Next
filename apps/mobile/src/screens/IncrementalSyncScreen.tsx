import React from 'react'
import { View, Text, StyleSheet, SafeAreaView, StatusBar } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/src/native/theme'
import { IncrementalSyncPanel } from '@baishou/ui/src/native/IncrementalSyncPanel'

const IncrementalSyncScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bgApp} />
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bgApp }]}>
        <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
          <View style={[styles.header, { backgroundColor: colors.bgSurface, borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t('incremental_sync.title', '增量同步')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('incremental_sync.description', '同步最近的数据变更')}
            </Text>
          </View>
          <View style={styles.content}>
            <IncrementalSyncPanel />
          </View>
        </View>
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1
  },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 4 },
  content: { flex: 1, padding: 16 }
})

export { IncrementalSyncScreen }
