import type { NetInfoState } from '@react-native-community/netinfo'

export type NetworkConnectionType = 'wifi' | 'cellular' | 'other' | 'unknown'

export function resolveConnectionType(state: NetInfoState | null): NetworkConnectionType {
  const type = state?.type
  if (!type || type === 'unknown') return 'unknown'
  if (type === 'wifi') return 'wifi'
  if (type === 'cellular') return 'cellular'
  return 'other'
}

export function resolveIsMetered(
  state: NetInfoState | null,
  connectionType: NetworkConnectionType
): boolean {
  if (connectionType === 'cellular') return true
  const details = state?.details as { isConnectionExpensive?: boolean | null } | null | undefined
  return details?.isConnectionExpensive === true
}
