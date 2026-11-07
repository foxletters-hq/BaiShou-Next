import React from 'react'
import { StyleSheet, View } from 'react-native'
import { AgentScreen } from '@/src/screens/AgentScreen'

export default function AgentTab() {
  return (
    <View style={styles.container}>
      <AgentScreen />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
})
