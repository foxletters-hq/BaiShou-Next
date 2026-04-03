import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'scripts/**',  // E2E 测试需要真实 API Key，不在单元测试中执行
    ],
  },
});
