import { test, expect } from '@playwright/test'
import { login } from './helpers'

// 需真实会话：无 SEED_PASSWORD（CI / 无凭据环境）时跳过，避免误红。
test.skip(!process.env.SEED_PASSWORD, '需 SEED_PASSWORD + 可登录的种子账号')

// 带登录集成冒烟：真实会话下各主页面正常渲染、无应用级报错。adminA 已是 platform_admin。
const ROUTES: { path: string; expectText: RegExp }[] = [
  { path: '/dashboard', expectText: /监控|调用量|Token/ },
  { path: '/agents-admin', expectText: /Agent|创建/ },
  { path: '/knowledge-admin', expectText: /知识库|上传|文档/ },
  { path: '/knowledge', expectText: /知识库问答|检索|提问/ },
  { path: '/members', expectText: /成员|添加成员/ },
  { path: '/tenants', expectText: /租户|开通企业/ },
  { path: '/skill-hub', expectText: /Skill|市场/ },
  { path: '/security', expectText: /安全|审核|待审/ },
]

test.describe('集成冒烟（带登录）', () => {
  for (const r of ROUTES) {
    test(`AUTH-SMOKE ${r.path}`, async ({ page }) => {
      const errors: string[] = []
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
      page.on('pageerror', (e) => errors.push(String(e)))
      await login(page, 'adminA')
      await page.goto(r.path)
      const main = page.locator('main')
      await expect(main).toBeVisible({ timeout: 15_000 })
      await expect(main).toContainText(r.expectText, { timeout: 15_000 })
      const appErrors = errors.filter((e) => !/favicon|Failed to load resource|net::ERR|hydrat/i.test(e))
      expect(appErrors, `「${r.path}」控制台报错：\n${appErrors.join('\n')}`).toHaveLength(0)
    })
  }
})
