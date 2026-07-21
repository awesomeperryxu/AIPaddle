import { test as setup } from '@playwright/test'
import fs from 'node:fs'
import { login, USER_KEYS, storageStatePath, AUTH_DIR } from './helpers'

// 全局登录态 setup（E道0.9）：为每个种子角色预登录一次并存盘 storageState，
// 供业务用例 test.use({ storageState: storageStatePath('adminA') }) 复用，免重复登录。
// 前置：先跑 `pnpm seed:e2e` 确保账号存在且密码=SEED_PASSWORD。
for (const key of USER_KEYS) {
  setup(`authenticate ${key}`, async ({ page }) => {
    fs.mkdirSync(AUTH_DIR, { recursive: true })
    await login(page, key)
    await page.context().storageState({ path: storageStatePath(key) })
  })
}
