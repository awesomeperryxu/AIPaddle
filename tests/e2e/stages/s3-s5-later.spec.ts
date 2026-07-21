/**
 * 切片 3-5 · Skill / Workflow / 成员与租户 E2E 骨架
 * （对应 docs/test-cases/TC-S3-S5-later.md；各切片启动时拆分为独立文件并细化选择器）
 * 测试数据已就绪：tests/e2e/fixtures/test-data.ts 的 SKILLS / WORKFLOWS / TENANT_ONBOARDING / MEMBER_INVITES
 */
import { test, expect } from '@playwright/test';
import { stageGate, login } from '../helpers';
import { SKILLS, WORKFLOWS, TENANT_ONBOARDING, MEMBER_INVITES } from '../fixtures/test-data';

test.describe('S3 Skill Hub 闭环 @stage3', () => {
  stageGate(3);

  for (const skill of SKILLS) {
    test(`S3-01 创建 ${skill.type} 类型 Skill：${skill.name}`, async ({ page }) => {
      await login(page, 'devA');
      await page.goto('/skill-hub');
      await page.getByRole('button', { name: /创建 Skill/ }).click();
      await page.getByLabel(/名称/).fill(skill.name);
      await page.getByLabel(/类型/).selectOption(skill.type);
      await page.getByLabel(/描述/).fill(skill.description);
      await page.getByLabel(/风险等级/).selectOption(skill.riskLevel);
      await page.getByRole('button', { name: /保存|创建/ }).click();
      // 原型与实现均为卡片布局（非表格），按 data-testid + data-skill-name 定位
      await expect(
        page.locator(`[data-testid="skill-card"][data-skill-name="${skill.name}"]`),
      ).toBeVisible();
    });
  }

  test('S3-04 高风险 Skill 发布必须过审核', async ({ page }) => {
    await login(page, 'devA');
    await page.goto('/skill-hub');
    const highRisk = SKILLS.find((s) => s.riskLevel === 'high')!;
    // 卡片布局：按 data-testid + data-skill-name 定位（非表格行）
    const row = page.locator(`[data-testid="skill-card"][data-skill-name="${highRisk.name}"]`);
    await row.getByRole('button', { name: /发布/ }).click();
    await expect(page.getByText(/已提交审核/)).toBeVisible();
    // 审核前状态不能直接变为已发布
    await expect(row.getByText(/已发布/)).toHaveCount(0);
  });

  test('S3-03 安装/卸载幂等，安装量准确', async ({ page }) => {
    await login(page, 'userA');
    await page.goto('/skill-hub');
    const lowRisk = SKILLS.find((s) => s.riskLevel === 'low')!;
    await page.getByText(lowRisk.name).click();
    const installs = Number(await page.getByTestId('skill-installs').innerText());
    await page.getByRole('button', { name: /^安装$/ }).click();
    await expect(page.getByRole('button', { name: /卸载/ })).toBeVisible();
    await expect
      .poll(async () => Number(await page.getByTestId('skill-installs').innerText()))
      .toBe(installs + 1);
    // 重复点击不重复计数（幂等）
    await page.getByRole('button', { name: /卸载/ }).click();
    await page.getByRole('button', { name: /^安装$/ }).click();
    await expect
      .poll(async () => Number(await page.getByTestId('skill-installs').innerText()))
      .toBe(installs + 1);
  });
});

test.describe('S4 Workflow 保存与执行 @stage4', () => {
  stageGate(4);

  test('S4-01 三节点流保存后刷新原样恢复 @smoke', async ({ page }) => {
    await login(page, 'devA');
    await page.goto('/workflows');
    await page.getByRole('button', { name: /创建工作流/ }).click();
    await page.getByLabel(/名称/).fill(WORKFLOWS.minimal.name);
    // 画布节点操作依实现细化：拖入 start/llm/end 并连线
    for (const node of WORKFLOWS.minimal.nodes) {
      await page.getByTestId(`block-${node.type}`).dragTo(page.getByTestId('canvas'));
    }
    await page.getByRole('button', { name: /保存/ }).click();
    await page.reload();
    for (const node of WORKFLOWS.minimal.nodes) {
      await expect(page.getByTestId('canvas').getByText(node.title)).toBeVisible();
    }
  });

  for (const bad of WORKFLOWS.invalidGraphs) {
    test(`S4-02 非法图被拦截：${bad.name}`, async ({ page }) => {
      await login(page, 'devA');
      await page.goto('/workflows');
      // 按 bad.nodes 构造非法图（实现后细化操作），断言保存被拒且提示定位
      await expect(page.getByText(new RegExp(bad.expectError))).toBeVisible();
    });
  }

  test('S4-04 最小执行引擎跑通并逐节点显示状态 @smoke', async ({ page }) => {
    await login(page, 'devA');
    await page.goto('/workflows');
    await page.getByText(WORKFLOWS.minimal.name).click();
    await page.getByRole('button', { name: /运行/ }).click();
    await page.getByLabel(/输入/).fill(WORKFLOWS.minimal.testInput);
    await page.getByRole('button', { name: /开始执行/ }).click();
    // 每个节点流转到成功
    for (const node of WORKFLOWS.minimal.nodes) {
      await expect(page.getByTestId(`node-status-${node.type}`)).toHaveAttribute('data-status', 'succeeded', {
        timeout: 60_000,
      });
    }
    const output = await page.getByTestId('run-result').innerText();
    for (const expected of WORKFLOWS.minimal.expectOutputContains) {
      expect(output).toContain(expected);
    }
  });
});

test.describe('S5 成员与租户闭环 @stage5', () => {
  stageGate(5);

  for (const invite of MEMBER_INVITES) {
    // 4.5.1 成员邀请已落地：添加成员对话框（邮箱/姓名/角色/部门→发送邀请，POST /api/members）
    // + 后端 inviteMember 幂等（重复邮箱返回「已邀请或已是成员」）
    test(`S5-01 邀请成员：${invite.name}（${invite.role}）`, async ({ page }) => {
      await login(page, 'adminA');
      await page.goto('/members');
      await page.getByRole('button', { name: /添加成员/ }).click();
      await page.getByLabel(/邮箱/).fill(invite.email);
      await page.getByLabel(/姓名/).fill(invite.name);
      await page.getByLabel(/角色/).selectOption(invite.role);
      await page.getByLabel(/部门/).fill(invite.department);
      await page.getByRole('button', { name: /发送邀请/ }).click();
      await expect(page.getByRole('row', { name: new RegExp(invite.email) })).toBeVisible();
      // 重复邀请幂等
      await page.getByRole('button', { name: /添加成员/ }).click();
      await page.getByLabel(/邮箱/).fill(invite.email);
      await page.getByRole('button', { name: /发送邀请/ }).click();
      await expect(page.getByText(/已邀请|已存在/)).toBeVisible();
    });
  }

  // 平台级租户开通/暂停（开通企业表单、暂停服务）尚未实现：无 app/api/tenants，
  // tenants-view「开通企业/暂停服务」为占位。待该功能落地后解除 fixme（另属租户管理切片）。
  test.fixme('S5-04 租户开通四区块表单（PRD 2.9.8）', async ({ page }) => {
    await login(page, 'adminA'); // 平台超管视角
    await page.goto('/tenants');
    await page.getByRole('button', { name: /开通企业/ }).click();
    const d = TENANT_ONBOARDING.valid;
    await page.getByLabel(/企业名称/).fill(d.basic.name);
    await page.getByLabel(/企业编码/).fill(d.basic.code);
    await page.getByLabel(/联系人姓名/).fill(d.contact.name);
    await page.getByLabel(/邮箱/).fill(d.contact.email);
    await page.getByLabel(/套餐/).selectOption(d.plan.type);
    await page.getByLabel(/Token 配额/).fill(String(d.plan.tokenQuota));
    await page.getByRole('button', { name: /提交|开通/ }).click();
    await expect(page.getByRole('row', { name: new RegExp(d.basic.name) })).toBeVisible();
  });

  for (const bad of TENANT_ONBOARDING.invalid) {
    test.fixme(`S5-04 开通表单校验：${bad.field} 非法值被拒`, async ({ page }) => {
      await login(page, 'adminA');
      await page.goto('/tenants');
      await page.getByRole('button', { name: /开通企业/ }).click();
      // 依字段填入非法值后提交
      await expect(page.getByText(new RegExp(bad.expectError))).toBeVisible();
    });
  }

  test.fixme('S5-05 暂停租户后其成员立即不可访问', async ({ page }) => {
    await login(page, 'adminA');
    await page.goto('/tenants');
    const row = page.getByRole('row', { name: new RegExp(TENANT_ONBOARDING.valid.basic.name) });
    await row.getByRole('button', { name: /暂停服务/ }).click();
    await page.getByRole('button', { name: /确认/ }).click();
    await expect(row.getByText(/已暂停/)).toBeVisible();
  });
});
