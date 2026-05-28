import { Redirect } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { ONBOARDING_STORAGE_KEY } from '@/src/constants/storage'

export default function Index() {
  const [ready, setReady] = useState(false)
  const [hasOnboarded, setHasOnboarded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_STORAGE_KEY)
      .then((value) => {
        setHasOnboarded(value === '1')
      })
      .finally(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    )
  }

  if (!hasOnboarded) {
    return <Redirect href="/onboarding" />
  }

  return <Redirect href="/(tabs)/agent" />
}
