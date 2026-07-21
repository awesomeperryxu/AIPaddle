/**
 * 切片 2 · 知识库闭环 + RAG E2E（对应 docs/test-cases/TC-S2-knowledge.md）
 * 启用条件：E2E_STAGE >= 2 · PRD 依据：2.4
 * 前置：tests/fixtures/docs/ 下的固定 PDF（由 scripts/gen-fixtures 生成）已就位
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { stageGate, login } from '../helpers';
import { KNOWLEDGE_DOCS, GOLDEN_SET_SAMPLE, UPLOAD_REJECTS } from '../fixtures/test-data';

const FIXTURE_DIR = path.join(__dirname, '../../fixtures/docs');

// 选中知识库卡片（原型为卡片布局，非表格；卡片带 data-kb-name）
function selectKb(page: import('@playwright/test').Page, name: string) {
  return page.locator(`[data-testid="kb-card"][data-kb-name="${name}"]`).click();
}
// 文档行（原型详情面板「最近文档」列表项，非表格 row）
function docRow(page: import('@playwright/test').Page, filename: string) {
  return page.locator(`[data-testid="kb-doc-row"][data-filename="${filename}"]`);
}

test.describe('S2-UPL 文档上传 @stage2', () => {
  stageGate(2);

  for (const doc of KNOWLEDGE_DOCS) {
    test(`S2-UPL-01 上传解析：${doc.file}`, async ({ page }) => {
      await login(page, 'devA');
      await page.goto('/knowledge-admin');
      await selectKb(page, doc.kb);
      // 原型上传按钮触发隐藏 <input type=file>（点击会开系统对话框，Playwright 直接 setInputFiles）
      await page.getByTestId('kb-upload-input').setInputFiles(path.join(FIXTURE_DIR, doc.file));
      const row = docRow(page, doc.file);
      await expect(row).toBeVisible({ timeout: 30_000 });
      // 状态最终流转到 active（解析+向量化完成）
      await expect(row.getByTestId('kb-doc-status')).toHaveText(/active/, { timeout: 60_000 });
    });
  }

  for (const bad of UPLOAD_REJECTS) {
    test(`S2-UPL-02/03 异常文件处理：${bad.file}（${bad.reason}）`, async ({ page }) => {
      await login(page, 'devA');
      await page.goto('/knowledge-admin');
      await selectKb(page, KNOWLEDGE_DOCS[0].kb);
      await page.getByTestId('kb-upload-input').setInputFiles(path.join(FIXTURE_DIR, bad.file));
      // 错误提示显示在上传状态区（依赖 /api/documents 返回对应错误文案）
      await expect(page.getByTestId('kb-upload-msg')).toContainText(new RegExp(bad.reason), { timeout: 30_000 });
    });
  }

  test('S2-UPL-04 删除文档后内容块同步清理', async ({ page }) => {
    // 删除走 window.confirm，自动接受
    page.on('dialog', (d) => d.accept());
    await login(page, 'devA');
    await page.goto('/knowledge-admin');
    await selectKb(page, KNOWLEDGE_DOCS[2].kb);
    const row = docRow(page, KNOWLEDGE_DOCS[2].file);
    await row.getByRole('button', { name: '删除文档' }).click();
    await expect(row).toHaveCount(0);
  });
});

test.describe('S2-IDX 检索测试 @stage2', () => {
  stageGate(2);

  // 4.2.5 检索测试面板已实现：测试召回 → 输入查询 → 召回分段带 retrieval-score（降序）
  test('S2-IDX-04 检索测试入口返回相关块且评分降序', async ({ page }) => {
    await login(page, 'devA');
    await page.goto('/knowledge-admin');
    await selectKb(page, KNOWLEDGE_DOCS[0].kb);
    await page.getByRole('button', { name: /测试召回|测试检索/ }).click();
    await page.getByRole('textbox', { name: /问题|查询/ }).fill('X1 保修多久');
    await page.getByRole('button', { name: /检索|搜索/ }).click();
    const scores = await page.getByTestId('retrieval-score').allInnerTexts();
    expect(scores.length).toBeGreaterThan(0);
    const nums = scores.map(Number);
    expect([...nums].sort((a, b) => b - a), '相关性评分应降序').toEqual(nums);
  });
});

test.describe('S2-RAG 基于知识库的问答 @stage2', () => {
  stageGate(2);

  // 金标准样例逐条验证（完整评测由 pnpm test:rag-eval 脚本跑全集，此处抽取 UI 主路径）
  for (const item of GOLDEN_SET_SAMPLE.filter((g) => g.type === 'fact')) {
    test(`S2-RAG-01 事实问答：${item.q}`, async ({ page }) => {
      await login(page, 'userA');
      await page.goto('/agents');
      await page.getByText('客服问答助手').click();
      await page.getByRole('textbox', { name: /输入|消息/ }).fill(item.q);
      await page.getByRole('button', { name: /发送/ }).click();
      const reply = page.getByTestId('chat-message-assistant').last();
      await expect(reply).toBeVisible({ timeout: 30_000 });
      const text = await reply.innerText();
      for (const point of item.expectPoints) {
        expect(text, `回答应包含要点「${point}」`).toContain(point);
      }
      // 引用正确
      if (item.source) {
        await expect(reply.getByTestId('citation')).toContainText(item.source);
      }
    });
  }

  for (const item of GOLDEN_SET_SAMPLE.filter((g) => g.type === 'refusal')) {
    test(`S2-RAG-02 拒答诚实：${item.q}`, async ({ page }) => {
      await login(page, 'userA');
      await page.goto('/agents');
      await page.getByText('客服问答助手').click();
      await page.getByRole('textbox', { name: /输入|消息/ }).fill(item.q);
      await page.getByRole('button', { name: /发送/ }).click();
      const reply = page.getByTestId('chat-message-assistant').last();
      await expect(reply).toBeVisible({ timeout: 30_000 });
      await expect(reply, '语料中无答案时必须如实拒答').toContainText(/未找到|没有相关|无法回答/);
    });
  }

  test('S2-RAG-04 删除文档后不再引用其内容', async ({ page }) => {
    // hr-policy.pdf 已在 S2-UPL-04 删除，其独有内容应转为拒答
    await login(page, 'userA');
    await page.goto('/agents');
    await page.getByText('客服问答助手').click();
    await page.getByRole('textbox', { name: /输入|消息/ }).fill('新员工年假有几天？');
    await page.getByRole('button', { name: /发送/ }).click();
    const reply = page.getByTestId('chat-message-assistant').last();
    await expect(reply).toBeVisible({ timeout: 30_000 });
    await expect(reply.getByTestId('citation')).not.toContainText('hr-policy.pdf');
  });
});
