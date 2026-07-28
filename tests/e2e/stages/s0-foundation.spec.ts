/**
 * 切片 0 · 地基闭环 E2E（对应 docs/test-cases/TC-S0-foundation.md）
 * 启用条件：E2E_STAGE >= 0（即切片 0 开发启动后，CI 设 E2E_STAGE=0）
 * 标签：@stage0；隔离专项另带 @isolation
 */
import { test, expect } from '@playwright/test';
import { stageGate, login, logout, expectNoText } from '../helpers';
import { USERS, BAD_CREDENTIALS, AGENTS, TENANTS } from '../fixtures/test-data';

test.describe('S0-AUTH 认证 @stage0', () => {
  stageGate(0);

  test('S0-AUTH-01 注册成功（新邮箱） @smoke', async ({ page }) => {
    const email = `e2e.reg.${Date.now()}@aipaddle-test.local`;
    await page.goto('/register');
    await page.getByLabel(/邮箱/).fill(email);
    await page.getByLabel(/^密码/).fill('E2e!Register_2026');
    await page.getByRole('button', { name: /注册/ }).click();
    // 应用行为：注册成功后自动登录并跳转控制台（非弹「注册成功」提示）。
    // 稳健判据：离开 /register 即视为注册成功。
    await expect(page).not.toHaveURL(/\/register/, { timeout: 15_000 });
  });

  test('S0-AUTH-02 重复注册被拒绝', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel(/邮箱/).fill(USERS.adminA.email);
    await page.getByLabel(/^密码/).fill('E2e!Whatever_2026');
    await page.getByRole('button', { name: /注册/ }).click();
    await expect(page.getByText(/已注册|已存在/)).toBeVisible();
  });

  test('S0-AUTH-03 登录→受保护页→退出→回踢 @smoke', async ({ page }) => {
    await login(page, 'adminA');
    await expect(page.getByTestId('user-menu')).toContainText(USERS.adminA.name);
    await logout(page);
    await page.goto('/'); // 再访问受保护页
    await expect(page).toHaveURL(/login/);
  });

  for (const cred of BAD_CREDENTIALS) {
    test(`S0-AUTH-04 错误凭证被拒：${cred.email}`, async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel(/邮箱/).fill(cred.email);
      await page.getByLabel(/密码/).fill(cred.password);
      await page.getByRole('button', { name: /登录/ }).click();
      await expect(page.getByText(new RegExp(cred.expect))).toBeVisible();
      await expect(page).toHaveURL(/login/);
    });
  }

  test('S0-AUTH-06 浏览器不直连 Supabase（ADR-001 约定）', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (req) => {
      if (/supabase\.(co|com)/.test(req.url())) external.push(req.url());
    });
    await login(page, 'adminA');
    await page.waitForTimeout(1500);
    expect(external, `发现浏览器直连 Supabase 的请求：\n${external.join('\n')}`).toHaveLength(0);
  });
});

test.describe('S0-ISO 租户隔离专项 @stage0 @isolation', () => {
  stageGate(0);

  test('S0-ISO-05 UI 层隔离：B 租户看不到 A 租户任何数据 @smoke', async ({ page }) => {
    await login(page, 'adminB');
    // 遍历核心页面，断言不出现 orgA 的标志性数据
    const orgAMarkers = [
      TENANTS.orgA.name, // orgA 真实租户名（seed：AIPaddle Demo）
      USERS.adminA.email,
      ...AGENTS.valid.map((a) => a.name),
    ];
    for (const path of ['/', '/agents-admin', '/members', '/knowledge-admin']) {
      await page.goto(path);
      await expectNoText(page, orgAMarkers);
    }
  });

  test('S0-ISO-01/03/04 API 层隔离（越权读/写/ID 猜测）', async ({ request, page }) => {
    // 以 adminB 会话获取 cookie 后直打 API（枚举 orgA 资源）
    await login(page, 'adminB');
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    // 约定：seed 脚本把 orgA 首个 Agent 的 ID 固定为已知值（或经 /api/e2e/seed-info 暴露给测试环境）
    const seedInfo = await request.get('/api/e2e/seed-info', { headers: { cookie: cookieHeader } });
    test.skip(!seedInfo.ok(), '测试环境未提供 seed-info 接口（仅测试环境启用）');
    const { orgAAgentId } = await seedInfo.json();

    // 越权读
    const read = await request.get(`/api/agents/${orgAAgentId}`, { headers: { cookie: cookieHeader } });
    expect([403, 404]).toContain(read.status());
    expect(await read.text()).not.toContain(AGENTS.valid[0].name);
    // 越权写
    const write = await request.patch(`/api/agents/${orgAAgentId}`, {
      headers: { cookie: cookieHeader },
      data: { name: '越权修改' },
    });
    expect([403, 404]).toContain(write.status());
    // ID 猜测
    for (const guess of ['1', '2', '00000000-0000-0000-0000-000000000001']) {
      const r = await request.get(`/api/agents/${guess}`, { headers: { cookie: cookieHeader } });
      expect([403, 404], `猜测 ID ${guess} 不应返回 2xx`).toContain(r.status());
    }
  });
});

test.describe('S0-PRM 权限校验 @stage0', () => {
  stageGate(0);

  test('S0-PRM-02 普通用户调管理员 API → 403', async ({ page, request }) => {
    await login(page, 'userA');
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const res = await request.post('/api/agents', {
      headers: { cookie: cookieHeader },
      data: { name: '越权创建', department: '市场部' },
    });
    expect(res.status()).toBe(403);
  });

  test('S0-PRM-01 角色可见性抽查（UI 层）', async ({ page }) => {
    // Auditor 只读：能看安全管理，不能见"创建 Agent"按钮
    await login(page, 'auditorA');
    await page.goto('/agents-admin');
    await expect(page.getByRole('button', { name: /创建 Agent/ })).toHaveCount(0);
    await page.goto('/security');
    // 用精确 tab 角色定位，避免同时匹配统计卡的 <p>待审核</p>（strict 模式歧义）
    await expect(page.getByRole('tab', { name: '待审核' })).toBeVisible();
  });
});

test.describe('S0-DAL 数据层与持久化 @stage0', () => {
  stageGate(0);

  // 交互已随 4.1.13a 变更：点「创建 Agent」不再弹名称对话框，而是直接以
  // 「未命名 Agent」建草稿并跳转编排页，名称在顶栏输入框改、自动保存。
  // 本用例此前停留在旧交互上——因为 stages 从未在 CI 跑过，脱节一直没被发现。
  test('S0-DAL-02 操作后刷新数据仍在 @smoke', async ({ page }) => {
    await login(page, 'devA');
    const marker = `持久化验证-${Date.now()}`;

    await page.goto('/agents-admin');
    // 「创建 Agent」是下拉菜单（AI 帮我建 / 创建空白 / 从模板 / 导入 DSL），
    // 走「创建空白」这条最短路径验证持久化
    await page.getByRole('button', { name: /创建 Agent/ }).click();
    await page.getByRole('menuitem', { name: /创建空白 Agent/ }).click();

    // 跳到编排页后在顶栏改名
    await expect(page).toHaveURL(/\/agents-admin\/[0-9a-f-]{36}/, { timeout: 15_000 });
    const nameInput = page.getByTestId('agent-name-input');
    await nameInput.fill(marker);
    // 自动保存是 800ms debounce，不是 blur 触发——等界面上的「已自动保存」再走，
    // 比 waitForTimeout 猜时间可靠（后者一旦 debounce 调参就会 flaky）
    await expect(page.getByText('已自动保存')).toBeVisible({ timeout: 15_000 });

    // 关键断言：回列表页刷新后数据仍在（验证真落库，而非仅前端状态）
    await page.goto('/agents-admin');
    await page.reload();
    await expect(page.getByText(marker)).toBeVisible({ timeout: 15_000 });
  });
});
