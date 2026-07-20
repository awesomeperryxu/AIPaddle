/**
 * Vitest 全局 setup：注入 jest-dom 断言（toBeInTheDocument 等）
 * 每个测试文件运行前自动加载（vitest.config.ts setupFiles）。
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// 每条用例后卸载 React 树，避免跨用例 DOM 残留
afterEach(() => {
  cleanup()
})
