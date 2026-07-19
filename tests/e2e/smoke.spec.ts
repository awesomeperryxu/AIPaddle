/**
 * TC-00 原型冒烟集（docs/test-cases/TC-00-prototype.md 的可执行实现）
 * 用例 ID 与文档一一对应；@smoke 标记的用例构成 CI 合并前的冒烟集。
 * 原型现状：单页应用，侧边栏切换视图，数据来自 lib/mock-data.ts。
 */
import { test, expect, type Page } from '@playwright/test';

/** 侧边栏导航结构（与 components/app-sidebar.tsx 保持同步） */
const NAV_ITEMS: Array<{
  section: string;
  sectionDefaultOpen: boolean;
  item: string | RegExp;
  headerTitle: string;
  stub?: boolean; // true = “功能开发中”占位页
}> = [
  { section: '工作台', sectionDefaultOpen: true, item: '监控', headerTitle: '监控' },
  { section: '工作台', sectionDefaultOpen: true, item: '个人助理', headerTitle: '个人助理' },
  { section: 'Agent', sectionDefaultOpen: true, item: /Agent 管理/, headerTitle: 'Agent 管理' },
  { section: 'Agent', sectionDefaultOpen: true, item: '数字员工', headerTitle: '数字员工' },
  { section: 'Skill', sectionDefaultOpen: true, item: /Skill Hub/, headerTitle: 'Skill Hub' },
  { section: 'Skill', sectionDefaultOpen: true, item: '我的 Skill', headerTitle: '我的 Skill' },
  { section: '知识库', sectionDefaultOpen: false, item: '知识库管理', headerTitle: '知识库管理' },
  { section: '知识库', sectionDefaultOpen: false, item: '知识库问答', headerTitle: '知识库问答' },
  { section: '工作流', sectionDefaultOpen: false, item: '工作流管理', headerTitle: '工作流管理' },
  { section: '安全与管理', sectionDefaultOpen: false, item: /安全管理/, headerTitle: '安全管理' },
  { section: '安全与管理', sectionDefaultOpen: false, item: '成员管理', headerTitle: '成员管理' },
  { section: '平台管理', sectionDefaultOpen: false, item: '运营看板', headerTitle: '运营看板' },
  { section: '平台管理', sectionDefaultOpen: false, item: '租户管理', headerTitle: '租户管理' },
  { section: '平台管理', sectionDefaultOpen: false, item: 'Key 管理', headerTitle: 'Key 管理', stub: true },
  { section: '平台管理', sectionDefaultOpen: false, item: '账单管理', headerTitle: '账单管理', stub: true },
];

/** 点击侧边栏条目（默认折叠的分组先展开） */
async function openView(page: Page, entry: (typeof NAV_ITEMS)[number]) {
  const sidebar = page.locator('aside');
  const itemButton =
    typeof entry.item === 'string'
      ? sidebar.getByRole('button', { name: entry.item, exact: true })
      : sidebar.getByRole('button', { name: entry.item });

  if (!(await itemButton.isVisible())) {
    // 分组标题按钮用 exact 匹配，避免「知识库」命中「知识库管理」
    await sidebar.getByRole('button', { name: entry.section, exact: true }).click();
  }
  await itemButton.click();
}

/** 收集页面报错（P-GLB-01 用） */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('favicon')) {
      errors.push(`console: ${msg.text()}`);
    }
  });
  return errors;
}

test.describe('P-GLB 全局冒烟', () => {
  test('P-GLB-01 应用可启动，无页面报错 @smoke', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'AIPaddle' })).toBeVisible();
    await expect(page.locator('header h2')).toHaveText('监控');
    expect(errors, `页面报错：\n${errors.join('\n')}`).toHaveLength(0);
  });

  test('P-GLB-02 侧边栏 15 个入口全部可达 @smoke', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    for (const entry of NAV_ITEMS) {
      await openView(page, entry);
      // 顶栏标题正确切换
      await expect(page.locator('header h2'), `进入「${entry.headerTitle}」后顶栏标题应更新`).toHaveText(
        entry.headerTitle,
      );
      // 主内容区非空渲染
      if (entry.stub) {
        await expect(page.getByText('功能开发中')).toBeVisible();
      } else {
        const main = page.locator('main');
        await expect(main).toBeVisible();
        expect((await main.innerText()).trim().length, `「${entry.headerTitle}」主内容区不应为空`).toBeGreaterThan(0);
      }
    }
    expect(errors, `遍历过程中出现报错：\n${errors.join('\n')}`).toHaveLength(0);
  });

  test('P-GLB-04 明暗主题切换后界面正常', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    const wasDark = await html.evaluate((el) => el.classList.contains('dark'));
    // 用户菜单 → 主题切换项
    await page.locator('aside').getByRole('button', { name: /陈雪/ }).click();
    await page.getByRole('menuitem', { name: wasDark ? '浅色模式' : '深色模式' }).click();
    await expect
      .poll(async () => html.evaluate((el) => el.classList.contains('dark')))
      .toBe(!wasDark);
    // 切换后核心内容仍可见
    await expect(page.locator('header h2')).toBeVisible();
  });
});

test.describe('P-DSH Dashboard', () => {
  test('P-DSH-01 统计卡与图表渲染 @smoke', async ({ page }) => {
    await page.goto('/');
    const main = page.locator('main');
    // Recharts 图表以 svg 渲染；原型至少应有一张图
    await expect(main.locator('svg').first()).toBeVisible();
    // 主区应有数字统计内容
    expect(await main.innerText()).toMatch(/\d/);
  });
});

test.describe('P-AGT Agent 管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await openView(page, NAV_ITEMS.find((n) => n.headerTitle === 'Agent 管理')!);
  });

  test('P-AGT-02 搜索框存在且可输入', async ({ page }) => {
    const main = page.locator('main');
    const search = main.getByRole('textbox').first();
    await expect(search).toBeVisible();
    await search.fill('测试搜索关键字');
    await expect(search).toHaveValue('测试搜索关键字');
  });
});

test.describe('P-WF 工作流编辑器', () => {
  test('P-WF-01 画布页可进入且无崩溃 @smoke', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await openView(page, NAV_ITEMS.find((n) => n.headerTitle === '工作流管理')!);
    await expect(page.locator('main')).toBeVisible();
    expect(errors, `工作流页面报错：\n${errors.join('\n')}`).toHaveLength(0);
  });
});

/**
 * 说明：
 * - P-AGT-01/03（页签筛选与详情抽屉的数据断言）、P-SKL/P-KB/P-SEC/P-MBR/P-TNT 的列表断言
 *   依赖 mock 数据的具体内容，原型阶段先由手动执行覆盖（见 TC-00 文档），
 *   待切片 0 接入真实数据层后，再以固定 seed 数据补全为自动化断言。
 * - P-AGT-04（无功能按钮盘点）与 P-WF-02（刷新丢失基线）为人工记录型用例，不做自动化。
 */
