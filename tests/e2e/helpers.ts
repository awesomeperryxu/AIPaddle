/**
 * E2E 公共辅助：阶段门控 + 登录 + 通用操作
 */
import { test, expect, type Page } from '@playwright/test';
import { USERS } from './fixtures/test-data';

/**
 * 阶段门控：CI 通过环境变量 E2E_STAGE 控制启用到哪个切片。
 *   E2E_STAGE=0 → 只跑冒烟 + 切片 0 用例；E2E_STAGE=2 → 启用到切片 2；缺省为 -1（只跑原型冒烟）。
 * 用法：stageGate(1) 放在 describe 首行，未到阶段的用例整组 skip（CI 显示为 skipped 而非 failed）。
 */
export const CURRENT_STAGE = Number(process.env.E2E_STAGE ?? '-1');
export function stageGate(required: number, reason?: string) {
  test.skip(CURRENT_STAGE < required, reason ?? `切片 ${required} 未启用（当前 E2E_STAGE=${CURRENT_STAGE}）`);
}

export type UserKey = keyof typeof USERS;

/** 登录（切片 0 落地后按真实登录页微调选择器；约定见 tests/e2e/README.md） */
export async function login(page: Page, userKey: UserKey) {
  const user = USERS[userKey];
  await page.goto('/login');
  await page.getByLabel(/邮箱|email/i).fill(user.email);
  await page.getByLabel(/密码|password/i).fill(user.password);
  await page.getByRole('button', { name: /登录|sign in/i }).click();
  // 登录后经 / → /console 跳转链，最终目的地是受保护门户；
  // 稳健判据：URL 不再是 /login（离开登录页即视为登录成功），避开中间跳转竞争（原 /dashboard|/$ 判据 flaky）。
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

export async function logout(page: Page) {
  await page.getByTestId('user-menu').click();
  await page.getByRole('menuitem', { name: /退出登录/ }).click();
  await expect(page).toHaveURL(/login/);
}

/** 断言页面任何位置都不出现指定文本（租户隔离 UI 断言用） */
export async function expectNoText(page: Page, texts: readonly string[]) {
  const content = await page.locator('body').innerText();
  for (const t of texts) {
    expect(content, `页面不应出现他租户数据「${t}」`).not.toContain(t);
  }
}
