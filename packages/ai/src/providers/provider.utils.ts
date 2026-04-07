import { AiProviderModel } from '@baishou/shared';

// In-memory cache for tracking the last used API key for each provider
const providerKeyRotatorState = new Map<string, string>();

/**
 * Returns a rotated API key from a comma-separated list of keys in the provider config.
 * Implements a simple round-robin selection.
 */
export function getRotatedApiKey(providerConfig: AiProviderModel): string {
  const currentKeyString = providerConfig.apiKey;
  if (!currentKeyString || currentKeyString.trim() === '') {
    return '';
  }

  const keys = currentKeyString
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);

  if (keys.length === 0) {
    return '';
  }

  if (keys.length === 1) {
    return keys[0] as string;
  }

  const cacheKey = `provider:${providerConfig.id}:last_used_key`;
  const lastUsedKey = providerKeyRotatorState.get(cacheKey);

  if (!lastUsedKey) {
    providerKeyRotatorState.set(cacheKey, keys[0] as string);
    return keys[0] as string;
  }

  const currentIndex = keys.indexOf(lastUsedKey);
  const nextIndex = (currentIndex + 1) % keys.length;
  const nextKey = keys[nextIndex] as string;

  providerKeyRotatorState.set(cacheKey, nextKey);
  return nextKey;
}
