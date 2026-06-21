/**
 * ESLint：禁止 UI/业务层直接 import 底层 cache invalidate API。
 * 与 scripts/audit-cache-invalidation.mjs 规则对齐。
 */
export const cacheCoordinatorImportRestrictions = {
  files: ['apps/**/src/**/*.{ts,tsx}', 'packages/core/src/**/*.{ts,tsx}'],
  ignores: [
    '**/register-*-cache-stores.ts',
    '**/*cache-coordinator.ts',
    '**/summary-dashboard-cache.ts',
    '**/*-display.util.ts',
    '**/mobile-mcp-context.service.ts',
    '**/agent-helpers.ts',
    '**/mobile-attachment-image-cache.ts',
    '**/chat-attachment-thumbnail.util.ts',
    '**/mobile-tts-settings.service.ts',
    '**/__tests__/**',
    '**/*.test.ts',
    '**/*.test.tsx'
  ],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/user-avatar-display.util', '**/assistant-avatar-display.util'],
            message:
              '禁止直接失效头像缓存。请通过 SettingsManager.set / AssistantManager 写路径，或 emitSyncMutation。'
          },
          {
            group: ['**/summary-dashboard-cache'],
            importNames: ['invalidateSummaryDashboardCache'],
            message:
              '禁止直接失效 Dashboard 缓存。请通过 Core 写路径或 emitSyncMutation / emitVaultSwitchMutation。'
          }
        ]
      }
    ]
  }
}
