import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 免依赖加载 .env.local（gitignored）：让 E2E 拿到 SEED_PASSWORD 等测试密钥，
 * 避免密码硬编码进 git（仓库公开后的安全铁律）。已存在的 process.env 优先，不覆盖。
 */
(() => {
  const envPath = path.resolve(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
})();

/**
 * AIPaddle E2E 配置（ROADMAP 0.9 · docs/TESTING.md L4 层）
 * 运行：pnpm test:e2e          全部
 *      pnpm test:e2e --grep @smoke   仅冒烟集
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  /**
   * BUG-96：worker 上限锁在 2。
   *
   * 🔴 根因是 `webServer` 跑的是 `pnpm dev`——Next.js 开发服务器**按需即时编译**。
   * 多个 worker 同时首访不同路由（/login、/api/auth/login、/dashboard…）会触发并发编译，
   * CPU 打满后单个请求就撞 30s timeout。挂哪一条完全随机：台账 BUG-96 记的是
   * 4 条 S0 用例超时，2026-08-06 复现时却是 auth.setup 的 adminB 登录超时、
   * 导致后续 12 个用例直接 did not run——随机性正是资源争抢的特征，不是用例本身的问题。
   *
   * 实测（本机 12 核）：
   *   workers=6（默认 = 核数/2）→ setup 即挂，12 用例未跑
   *   workers=2                → 17 passed，1.4m
   *   workers=1                → 17 passed，2.6m
   * 取 2：稳定且比串行快近一倍。
   *
   * ⚠️ 提高此值前，先把 webServer 换成生产构建（build + start，无即时编译），
   * 否则只是把随机失败的概率调回去。
   */
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // 全局登录态：先为各角色生成 storageState（E道0.9）
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
