import { Redirect, useLocalSearchParams } from 'expo-router'
import { View, StyleSheet } from 'react-native'
import { SettingsDetailScreen } from '@/src/screens/SettingsScreen/SettingsDetailScreen'
import { SETTINGS_SECTION_IDS } from '@/src/screens/SettingsScreen/settingsHubItems'

export default function SettingsSectionRoute() {
  const { section: sectionParam } = useLocalSearchParams<{ section: string | string[] }>()
  const section = Array.isArray(sectionParam) ? sectionParam[0] : sectionParam

  if (section === 'tts') {
    return <Redirect href="/settings/tts" />
  }

  if (!section || !SETTINGS_SECTION_IDS.has(section)) {
    return <Redirect href="/(tabs)/settings" />
  }

  return (
    <View style={styles.root}>
      <SettingsDetailScreen section={section} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 }
})
