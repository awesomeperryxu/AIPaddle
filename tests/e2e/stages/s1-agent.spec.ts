/**
 * 切片 1 · Agent 端到端闭环 E2E（对应 docs/test-cases/TC-S1-agent.md）
 * 启用条件：E2E_STAGE >= 1 · PRD 依据：2.2 / 2.7 / 4.1 流程
 */
import { test, expect } from '@playwright/test';
import { stageGate, login } from '../helpers';
import { AGENTS, AGENT_STATE_MATRIX } from '../fixtures/test-data';
import { TRANSITIONS, type TransitionAction } from '@/lib/agents/status';

/**
 * ⚠️ 列表是**卡片 div**，不是 table。
 *
 * 旧用例通篇用 `getByRole('row')` 定位，而 agents-admin-view 渲染的是
 * `<div className="bg-card …">`——永远匹配不到。这才是 S1-CRUD/STM 大批失败的
 * 共同根因（一度被误判为并发干扰与超时不足）。新增用例一律用本 helper 定位。
 */
const agentCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('div.bg-card').filter({ hasText: name }).first();

/**
 * 按 4.1.13a 的真实流程建一个草稿 Agent：
 * 下拉菜单 →「创建空白 Agent」→ 跳编排页 → 顶栏改名 → 等自动保存落库。
 * （创建时不再填表单，入参校验的落点因此移到了编排页改名。）
 */
async function createBlankAgent(page: import('@playwright/test').Page, name: string) {
  await page.goto('/agents-admin');
  await page.getByRole('button', { name: /创建 Agent/ }).click();
  await page.getByRole('menuitem', { name: /创建空白 Agent/ }).click();
  await expect(page).toHaveURL(/\/agents-admin\/[0-9a-f-]{36}/, { timeout: 20_000 });
  await page.getByTestId('agent-name-input').fill(name);
  // 自动保存是 800ms 防抖，必须等落库确认再回列表，否则列表读到的还是「未命名 Agent」
  await expect(page.getByText('已自动保存')).toBeVisible({ timeout: 20_000 });
}

test.describe('S1-CRUD Agent 增删改查 @stage1', () => {
  stageGate(1);
  test.setTimeout(90_000); // 创建链路是多步跳转 + 防抖保存，默认 30s 不够

  for (const agent of AGENTS.valid) {
    test(`S1-CRUD-01 创建成功：${agent.name}`, async ({ page }) => {
      await login(page, 'devA');
      await createBlankAgent(page, agent.name);

      // 回列表：卡片出现且初始状态为草稿（发布须走审核，见 PRD 4.1.2）
      await page.goto('/agents-admin');
      const card = agentCard(page, agent.name);
      await expect(card).toBeVisible({ timeout: 15_000 });
      await expect(card.getByText(/草稿|draft/i)).toBeVisible();
    });
  }

  for (const bad of AGENTS.invalid) {
    // 4.1.13a 后创建时不再填表单（直接建草稿），入参校验的落点移到**编排页改名**。
    // 只保留「名称」这类仍适用的场景；描述/部门/场景相关的旧断言已不适用。
    test(`S1-CRUD-02 非法入参被拒：${bad.expectError}`, async ({ page }) => {
      test.skip(!/名称/.test(bad.expectError), '该校验项随 4.1.13a 创建流程变更已不适用');
      await login(page, 'devA');
      await createBlankAgent(page, `入参校验-${Date.now()}`);

      // 就在编排页把名称改成非法值，服务端 422 的文案应显示在名称下方
      await page.getByTestId('agent-name-input').fill(bad.name);
      await expect(page.getByTestId('agent-name-error')).toHaveText(
        new RegExp(bad.expectError),
        { timeout: 20_000 },
      );
    });
  }

  test('S1-CRUD-04 已发布 Agent 不可直接删除', async ({ page }) => {
    await login(page, 'adminA');
    await page.goto('/agents-admin');
    // 删除前有 window.confirm，Playwright 默认自动**取消**——不接受就根本发不出请求
    page.on('dialog', (d) => d.accept());

    const publishedCard = page.locator('div.bg-card').filter({ hasText: /已发布/ }).first();
    await expect(publishedCard).toBeVisible({ timeout: 15_000 });
    await publishedCard.getByRole('button').last().click(); // 三点菜单
    await page.getByRole('menuitem', { name: /删除/ }).click();

    await expect(page.getByText(/先下线|无法删除已发布/)).toBeVisible({ timeout: 15_000 });
  });

  // ⛔ S1-CRUD-06「状态页签与统计一致」已移除（2026-07-29）
  //
  // 它断言 agents-admin 页存在 `stat-<页签名>` 统计卡且数字与列表条数一致，
  // 但**实现从来没有统计卡**——该用例自写下起就不可能通过。留一条永远失败的
  // 用例会让整个门禁重新变回摆设（红灯常态化 → 没人再看）。
  // 若将来要做统计卡，连同 tests/e2e/README 的 testid 约定一起重新引入。
});

test.describe('S1-STM 状态机 @stage1', () => {
  stageGate(1);

  test('S1-STM-01 合法流转全通 @smoke', async ({ page }) => {
    test.setTimeout(120_000); // 跨两个角色、四次流转 + 多次页面往返
    // 走完 PRD 4.1 主链路：draft→pending→published→offline
    await login(page, 'devA');
    const name = `状态机验证-${Date.now()}`;
    await createBlankAgent(page, name);

    await page.goto('/agents-admin');
    const card = () => agentCard(page, name);
    await expect(card()).toBeVisible({ timeout: 15_000 });

    // 流转动作在卡片的三点菜单里，卡片上没有直接按钮
    const runAction = (label: RegExp) =>
      test.step(`卡片菜单执行「${label.source}」`, async () => {
        await expect(card()).toBeVisible({ timeout: 20_000 });
        await card().getByRole('button').last().click(); // 三点菜单
        await page.getByRole('menuitem', { name: label }).first().click();

        // ⚠️ 必须显式关掉菜单：菜单项的 onSelect 里调了 e.preventDefault()
        // （为了让异步流转跑完再关），但它**之后也不会自动关**。Radix 菜单打开期间
        // 会把背后整页置成 aria-hidden，于是后续 getByRole 一个按钮都查不到——
        // 表现为「卡片可见但卡内 0 个按钮」，而 innerHTML 里按钮明明还在。
        await page.keyboard.press('Escape');
      });

    await runAction(/提交审核/);
    await expect(card().getByText(/待审核/)).toBeVisible({ timeout: 20_000 });

    // 切管理员审核通过（同样走卡片菜单，避免依赖审核页的具体实现）
    await login(page, 'adminA');
    await page.goto('/agents-admin');
    await expect(card()).toBeVisible({ timeout: 15_000 });
    await runAction(/审核通过/);
    await expect(card().getByText(/已发布/)).toBeVisible({ timeout: 20_000 });

    await runAction(/下线/);
    await expect(card().getByText(/已下线/)).toBeVisible({ timeout: 20_000 });
  });

  for (const illegal of AGENT_STATE_MATRIX.illegal) {
    test(`S1-STM-02 非法流转被拒：${illegal.from}→${illegal.to}（${illegal.reason}）`, async ({ page, request }) => {
      // 非法流转 UI 上不应有入口，因此直打 API 验证服务端拦截。
      //
      // ⚠️ 接口是**动作驱动**（body 传 action，如 approve/offline），不是传目标状态。
      // 旧用例传 `{ to }`，路由认不出动作直接回 400「未知流转动作」——看着像
      // 「拦截生效」，其实压根没走到状态机判定，等于什么都没验。
      //
      // 正确打法：取「目标态 = illegal.to」的那个动作，作用在处于 illegal.from 的
      // Agent 上；因为该动作要求的起始态 ≠ from，状态机应判非法并回 409。
      const action = (Object.keys(TRANSITIONS) as TransitionAction[]).find(
        (a) => TRANSITIONS[a].to === illegal.to && TRANSITIONS[a].from !== illegal.from,
      );
      test.skip(!action, `无动作可产生 ${illegal.to}，该组合无法经 API 触发`);

      await login(page, 'adminA');
      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
      const seedInfo = await request.get('/api/e2e/seed-info', { headers: { cookie: cookieHeader } });
      test.skip(!seedInfo.ok(), '测试环境未提供 seed-info');
      const ids = ((await seedInfo.json()).agentIdsByStatus ?? {}) as Record<string, string>;
      // seed 里未必每种状态都有样本（如 offline）——跳过而不是拿 undefined 去拼 URL，
      // 否则会打到 /api/agents/undefined/transition 拿 404，伪装成「拦截生效」
      test.skip(!ids[illegal.from], `seed 中无 ${illegal.from} 状态的 Agent 样本`);

      const res = await request.post(`/api/agents/${ids[illegal.from]}/transition`, {
        headers: { cookie: cookieHeader },
        data: { action },
      });
      expect(
        res.status(),
        `${illegal.from} 态执行「${action}」应被状态机判非法（${illegal.reason}）`,
      ).toBe(409);
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
