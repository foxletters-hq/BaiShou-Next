import { useColorScheme } from 'react-native';
import { lightColors, darkColors, sharedTokens } from '../theme';

export function useNativeTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = isDark ? darkColors : lightColors;
  return { colors, tokens: sharedTokens, isDark };
}
