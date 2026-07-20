import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

/**
 * AIPaddle 单元/集成测试配置（ROADMAP 0.9b · docs/TESTING.md L2/L3 层）
 * 运行：pnpm test         单跑一次
 *      pnpm test:watch   监听模式
 * E2E（Playwright）单独用 pnpm test:e2e，不走这里。
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/unit/setup.ts'],
    // 只收单元/集成用例；E2E 目录交给 Playwright
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}', 'lib/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      // 'server-only' 在 Node/jsdom 环境无意义，测试时 stub 掉
      'server-only': fileURLToPath(new URL('./tests/unit/__mocks__/server-only.ts', import.meta.url)),
    },
  },
})
