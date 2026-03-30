import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { OnboardingScreen } from '../src/screens/OnboardingScreen';

export default function Index() {
  // Mock logic: assuming first open, we show Onboarding
  const [hasOnboarded, setHasOnboarded] = useState(false);

  if (hasOnboarded) {
    return <Redirect href="/(tabs)/agent" />;
  }

  return <OnboardingScreen />;
}
