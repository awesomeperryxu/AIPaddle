/**
 * 切片 1 · Agent 端到端闭环 E2E（对应 docs/test-cases/TC-S1-agent.md）
 * 启用条件：E2E_STAGE >= 1 · PRD 依据：2.2 / 2.7 / 4.1 流程
 */
import { test, expect } from '@playwright/test';
import { stageGate, login } from '../helpers';
import { AGENTS, AGENT_STATE_MATRIX } from '../fixtures/test-data';

test.describe('S1-CRUD Agent 增删改查 @stage1', () => {
  stageGate(1);

  for (const agent of AGENTS.valid) {
    test(`S1-CRUD-01 创建成功：${agent.name}`, async ({ page }) => {
      await login(page, 'devA');
      await page.goto('/agents-admin');
      await page.getByRole('button', { name: /创建 Agent/ }).click();
      await page.getByLabel(/名称/).fill(agent.name);
      await page.getByLabel(/描述/).fill(agent.description);
      await page.getByLabel(/部门/).fill(agent.department);
      for (const s of agent.scenarios) {
        await page.getByRole('checkbox', { name: new RegExp(s, 'i') }).check();
      }
      await page.getByRole('button', { name: /保存|创建/ }).click();
      // 列表出现且初始状态为草稿
      const row = page.getByRole('row', { name: new RegExp(agent.name) });
      await expect(row).toBeVisible();
      await expect(row.getByText(/草稿|draft/i)).toBeVisible();
    });
  }

  for (const bad of AGENTS.invalid) {
    test(`S1-CRUD-02 非法入参被拒：${bad.expectError}`, async ({ page }) => {
      await login(page, 'devA');
      await page.goto('/agents-admin');
      await page.getByRole('button', { name: /创建 Agent/ }).click();
      await page.getByLabel(/名称/).fill(bad.name);
      await page.getByLabel(/部门/).fill(bad.department);
      await page.getByRole('button', { name: /保存|创建/ }).click();
      await expect(page.getByText(new RegExp(bad.expectError))).toBeVisible();
    });
  }

  test('S1-CRUD-04 已发布 Agent 不可直接删除', async ({ page }) => {
    await login(page, 'adminA');
    await page.goto('/agents-admin');
    const row = page.getByRole('row', { name: /已发布|published/i }).first();
    await row.getByRole('button', { name: /更多|操作/ }).click();
    await page.getByRole('menuitem', { name: /删除/ }).click();
    await expect(page.getByText(/先下线|无法删除已发布/)).toBeVisible();
  });

  test('S1-CRUD-06 状态页签与统计一致 @smoke', async ({ page }) => {
    await login(page, 'adminA');
    await page.goto('/agents-admin');
    // 页签集以原型 AgentsAdminView 为准：全部/草稿/待审核/已发布（无独立「已下线」筛选页签；
    // offline 是 Agent 状态但原型未设该页签，如需再由「已下线页签」切片补 Tab+stat-已下线 testid）
    for (const tab of ['全部', '草稿', '待审核', '已发布']) {
      await page.getByRole('tab', { name: tab }).click();
      const count = await page.getByRole('row').count();
      const statNumber = await page.getByTestId(`stat-${tab}`).innerText();
      expect(Number(statNumber), `「${tab}」统计卡与列表条数应一致`).toBe(count - 1); // 减表头行
    }
  });
});

test.describe('S1-STM 状态机 @stage1', () => {
  stageGate(1);

  test('S1-STM-01 合法流转全通 @smoke', async ({ page }) => {
    // 走完 PRD 4.1 主链路：draft→pending→published→offline
    await login(page, 'devA');
    const name = `状态机验证-${Date.now()}`;
    await page.goto('/agents-admin');
    await page.getByRole('button', { name: /创建 Agent/ }).click();
    await page.getByLabel(/名称/).fill(name);
    await page.getByLabel(/部门/).fill('研发部');
    await page.getByRole('button', { name: /保存|创建/ }).click();

    const row = () => page.getByRole('row', { name: new RegExp(name) });
    await row().getByRole('button', { name: /提交审核/ }).click();
    await expect(row().getByText(/待审核/)).toBeVisible();

    // 切管理员审核通过
    await login(page, 'adminA');
    await page.goto('/security');
    const reviewRow = page.getByRole('row', { name: new RegExp(name) });
    await reviewRow.getByRole('button', { name: /批准|通过/ }).click();
    await page.goto('/agents-admin');
    await expect(row().getByText(/已发布/)).toBeVisible();

    await row().getByRole('button', { name: /下线/ }).click();
    await expect(row().getByText(/已下线/)).toBeVisible();
  });

  for (const illegal of AGENT_STATE_MATRIX.illegal) {
    test(`S1-STM-02 非法流转被拒：${illegal.from}→${illegal.to}（${illegal.reason}）`, async ({ page, request }) => {
      // 非法流转 UI 上不应有入口，因此直打 API 验证服务端拦截
      await login(page, 'adminA');
      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
      const seedInfo = await request.get('/api/e2e/seed-info', { headers: { cookie: cookieHeader } });
      test.skip(!seedInfo.ok(), '测试环境未提供 seed-info');
      const ids = (await seedInfo.json()).agentIdsByStatus as Record<string, string>;
      const res = await request.post(`/api/agents/${ids[illegal.from]}/transition`, {
        headers: { cookie: cookieHeader },
        data: { to: illegal.to },
      });
      expect([409, 422], `${illegal.from}→${illegal.to} 应被服务端拒绝`).toContain(res.status());
    });
  }

  test('S1-STM-03 提交人不能审核自己的 Agent', async ({ page }) => {
    await login(page, 'devA');
    await page.goto('/security');
    // Developer 无审核权限：无批准按钮（或整页 403）
    await expect(page.getByRole('button', { name: /批准|通过/ })).toHaveCount(0);
  });
});

test.describe('S1-CHAT 数字员工真实对话 @stage1', () => {
  stageGate(1);

  test('S1-CHAT-01 已发布 Agent 可对话且回答相关 @smoke', async ({ page }) => {
    await login(page, 'userA');
    await page.goto('/agents');
    await page.getByText(AGENTS.valid[0].name).click();
    const input = page.getByRole('textbox', { name: /输入|消息/ });
    await input.fill('你好，请介绍一下你能做什么');
    await page.getByRole('button', { name: /发送/ }).click();
    // 收到非空回复（放宽超时以容纳真实模型延迟）
    const reply = page.getByTestId('chat-message-assistant').last();
    await expect(reply).toBeVisible({ timeout: 30_000 });
    expect((await reply.innerText()).trim().length).toBeGreaterThan(10);
  });

  test('S1-CHAT-02 未发布 Agent 不出现在数字员工列表', async ({ page }) => {
    await login(page, 'userA');
    await page.goto('/agents');
    await expect(page.getByText(/状态机验证-/)).toHaveCount(0); // offline 的不可见
  });

  test('S1-CHAT-04 模型故障时界面友好降级', async ({ page }) => {
    await login(page, 'userA');
    // 约定：测试环境支持 ?e2e-fault=llm 注入模型故障
    await page.goto('/agents?e2e-fault=llm');
    await page.getByText(AGENTS.valid[0].name).click();
    await page.getByRole('textbox', { name: /输入|消息/ }).fill('触发故障');
    await page.getByRole('button', { name: /发送/ }).click();
    await expect(page.getByText(/暂时无法回复|稍后重试/)).toBeVisible({ timeout: 15_000 });
  });

  test('S1-CHAT-05 对话历史刷新后仍在，且仅本人可见', async ({ page }) => {
    await login(page, 'userA');
    const marker = `历史验证-${Date.now()}`;
    await page.goto('/agents');
    await page.getByText(AGENTS.valid[0].name).click();
    await page.getByRole('textbox', { name: /输入|消息/ }).fill(marker);
    await page.getByRole('button', { name: /发送/ }).click();
    await page.reload();
    await expect(page.getByText(marker)).toBeVisible();
    // 换账号不可见
    await login(page, 'devA');
    await page.goto('/agents');
    await page.getByText(AGENTS.valid[0].name).click();
    await expect(page.getByText(marker)).toHaveCount(0);
  });
});

test.describe('S1-LOG 调用日志 @stage1', () => {
  stageGate(1);

  test('S1-LOG-01 调用后日志计数与指标同步', async ({ page }) => {
    await login(page, 'adminA');
    await page.goto('/agents-admin');
    await page.getByText(AGENTS.valid[0].name).click();
    const before = Number(await page.getByTestId('metric-calls').innerText());
    // 发一次对话
    await login(page, 'userA');
    await page.goto('/agents');
    await page.getByText(AGENTS.valid[0].name).click();
    await page.getByRole('textbox', { name: /输入|消息/ }).fill('计数验证');
    await page.getByRole('button', { name: /发送/ }).click();
    await expect(page.getByTestId('chat-message-assistant').last()).toBeVisible({ timeout: 30_000 });
    // 回看指标 +1
    await login(page, 'adminA');
    await page.goto('/agents-admin');
    await page.getByText(AGENTS.valid[0].name).click();
    await expect
      .poll(async () => Number(await page.getByTestId('metric-calls').innerText()), { timeout: 15_000 })
      .toBe(before + 1);
  });
});
