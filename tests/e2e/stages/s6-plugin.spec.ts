/**
 * 切片 6 · Plugin / Tool 闭环 E2E（V12-4.1 ~ 4.5）
 * 启用条件：E2E_STAGE >= 6
 *
 * 闭环定义：建 Plugin → 建/导入 Tool → 配 Binding → 提交审核 → 发布 →
 *           连通性测试 → 下线阻断（有 Skill 依赖时）。
 *
 * 🔴 这个切片的重点不是"点得通"，是**守卫拦不拦得住**。
 * Plugin/Tool 是平台唯一对外发起请求（打 API、连数据库）的通道，
 * 配错一处的后果不是页面报错，是 SSRF 或数据被改。所以安全断言优先于交互断言。
 *
 * 用 request fixture 直打 API 而非点页面：这些约束的强制点在服务端，
 * 从页面点只能验证"前端没给入口"，验证不了"后端拦不拦"。
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { stageGate, storageStatePath } from '../helpers';

test.describe('S6-PLUGIN Plugin/Tool 闭环 @stage6', () => {
  stageGate(6);
  test.use({ storageState: storageStatePath('adminA') });

  /** 本切片建出来的 Plugin id，afterAll 统一清理 */
  const created: string[] = [];
  const tag = () => `e2e-s6-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

  async function newPlugin(request: APIRequestContext, providerType: 'mcp' | 'api' | 'db') {
    const res = await request.post('/api/plugins', {
      data: { name: tag(), providerType, description: 'S6 闭环用例' },
    });
    expect(res.status(), await res.text()).toBe(201);
    const id = (await res.json()).plugin.id as string;
    created.push(id);
    return id;
  }

  async function newTool(request: APIRequestContext, pluginId: string, bindingType: string) {
    const res = await request.post('/api/tools', {
      data: { pluginId, name: `t_${tag().replace(/-/g, '_')}`, bindingType, riskLevel: 'low' },
    });
    expect(res.status(), await res.text()).toBe(201);
    return (await res.json()).tool.id as string;
  }

  const newVersion = (request: APIRequestContext, toolId: string, bindingConfig: unknown) =>
    request.post(`/api/tools/${toolId}/versions`, {
      data: { version: `1.0.${Math.floor(Math.random() * 1e6)}`, bindingConfig },
    });

  /**
   * 🔴 清理不能写成 `delete(...).catch(() => {})`。
   * 已发布的 Plugin 删不掉（服务端按设计拒绝），而吞掉异常的写法会让
   * "清理失败"完全无声——本切片第一次跑就漏了 8 个 Plugin 在库里，
   * 与刚登记的 BUG-95（e2e 泄漏账号）是同一个毛病。
   *
   * 正确做法：先下线再删，且**把没清干净的报出来**。
   */
  test.afterAll(async ({ playwright, baseURL }) => {
    // 每个 Plugin 要串行走「列 Tool → 逐个下线 → 逐个删 → Plugin 下线 → 删」，
    // 十来个 Plugin 就是几十次请求，默认 30s 钩子超时不够
    test.setTimeout(180_000);

    // 🔴 不能用 test-scoped 的 `request` fixture：afterAll 里拿到的那个
    // **不带 test.use 的 storageState**，于是所有清理请求都以未登录身份发出、
    // 被静默拒绝。第一版就栽在这——用例全绿、库里却留了 5 个 Plugin，
    // 而失败只经 console.warn 报出，line reporter 根本不显示。
    // 必须显式建一个带登录态的 APIRequestContext。
    const request = await playwright.request.newContext({
      baseURL, storageState: storageStatePath('adminA'),
    });

    const leaked: string[] = [];
    for (const id of created) {
      try {
        // deletePlugin 有两个拒绝条件：状态为 published、以及名下还有 Tool。
        // 两个都要先处理掉，顺序不能反
        const tl = await request.get(`/api/tools?pluginId=${id}`);
        if (tl.ok()) {
          for (const t of (await tl.json()).tools as { id: string; status: string }[]) {
            if (t.status === 'published') {
              await request.post(`/api/tools/${t.id}/transition`,
                { data: { action: 'offline', confirm: true } });
            }
            await request.delete(`/api/tools/${t.id}`);
          }
        }
        await request.post(`/api/plugins/${id}/transition`, { data: { action: 'offline' } });
        const r = await request.delete(`/api/plugins/${id}`);
        if (!r.ok()) leaked.push(`${id}(${r.status()} ${await r.text()})`);
      } catch (e) {
        leaked.push(`${id}(${e instanceof Error ? e.message : 'unknown'})`);
      }
    }
    await request.dispose();

    // 🔴 清理失败必须让整组用例红掉，不能只 console.warn ——
    // warn 在 line reporter 下不显示，等于静默。残留数据会污染下一次运行，
    // 也会让「孤儿=异常」这个信号失效（BUG-95 就是这么积到 40 个的）
    expect(leaked, `S6 有 ${leaked.length} 个 Plugin 未清理：${leaked.join(', ')}`).toHaveLength(0);
  });

  // ── 闭环主线 ────────────────────────────────────────────────────────

  test('S6-FLOW-01 Plugin 全流程：建 → Tool → Binding → 提交 → 发布 @smoke', async ({ request }) => {
    // 这条要串行走完整个状态机（建 Plugin/Tool/版本 + 4 次流转 + 复核），
    // 实测冷启动的 dev server 上约 25s——每个首次命中的路由都要现编译。
    // 只给这条放宽，不动全局超时：其它用例真超时就是真有问题
    test.slow();

    const pluginId = await newPlugin(request, 'api');
    const toolId = await newTool(request, pluginId, 'api');

    const v = await newVersion(request, toolId, {
      endpoint: 'https://api.example.com/v1/ping',
      method: 'GET',
      allowed_hosts: ['api.example.com'],
    });
    expect(v.status(), await v.text()).toBe(201);

    // Plugin 与 Tool 各自走状态机：草稿 → 待审 → 已发布
    for (const [path, id] of [['plugins', pluginId], ['tools', toolId]] as const) {
      for (const action of ['submit', 'approve']) {
        const r = await request.post(`/api/${path}/${id}/transition`, { data: { action } });
        expect(r.ok(), `${path} ${action}: ${await r.text()}`).toBeTruthy();
      }
    }

    const list = await request.get(`/api/tools?pluginId=${pluginId}`);
    const tools = (await list.json()).tools as { id: string; status: string }[];
    expect(tools.find((t) => t.id === toolId)?.status).toBe('published');
  });

  test('S6-FLOW-02 OpenAPI 导入按 operation 拆出多个 Tool（AC-02）', async ({ request }) => {
    const pluginId = await newPlugin(request, 'api');
    const res = await request.post(`/api/plugins/${pluginId}/import-openapi`, {
      data: {
        allowedHosts: ['api.example.com'],
        document: {
          servers: [{ url: 'https://api.example.com/v1' }],
          paths: {
            '/users': { get: { operationId: 'listUsers' }, post: { operationId: 'createUser' } },
            '/users/{id}': { get: { operationId: 'getUser' } },
          },
        },
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    const body = await res.json();
    expect(body.imported).toBe(3);
    expect(body.failed).toHaveLength(0);
  });

  // ── 安全边界（本切片的重点）──────────────────────────────────────────

  test('S6-SEC-01 API Binding：http / 非白名单 / 空白名单一律拒绝', async ({ request }) => {
    const toolId = await newTool(request, await newPlugin(request, 'api'), 'api');

    const cases: [string, Record<string, unknown>][] = [
      ['http 明文', { endpoint: 'http://api.example.com/x', method: 'GET', allowed_hosts: ['api.example.com'] }],
      ['域名不在白名单', { endpoint: 'https://evil.com/x', method: 'GET', allowed_hosts: ['api.example.com'] }],
      ['白名单留空', { endpoint: 'https://api.example.com/x', method: 'GET', allowed_hosts: [] }],
      ['通配符白名单', { endpoint: 'https://api.example.com/x', method: 'GET', allowed_hosts: ['*'] }],
    ];
    for (const [label, cfg] of cases) {
      const r = await newVersion(request, toolId, cfg);
      expect(r.status(), `${label} 应被拒绝，实际 ${r.status()}`).toBe(400);
    }
  });

  test('S6-SEC-02 DB Binding：非 select 一律拒绝（含各种绕过构造）', async ({ request }) => {
    const toolId = await newTool(request, await newPlugin(request, 'db'), 'db');

    const attacks: [string, string][] = [
      ['直接 update', 'update orders set amount = 0'],
      ['分号追加 drop', 'select 1; drop table orders'],
      ['CTE 里藏 delete', 'with x as (delete from orders returning *) select * from x'],
      // 单引号内的 -- 不是注释，早期实现被这条绕过过（存库的是含 drop 的原文）
      ['字符串藏注释符', "select '--' as a from orders; drop table orders"],
      ['多条 select', 'select 1; select 2'],
    ];
    for (const [label, q] of attacks) {
      const r = await newVersion(request, toolId, { query_template: q, allowed_tables: ['orders'] });
      expect(r.status(), `${label} 应被拒绝，实际 ${r.status()}`).toBe(400);
    }

    // 合法只读查询要能过，否则就是把功能拦死了
    const ok = await newVersion(request, toolId, {
      query_template: 'select id from orders where created_at > :since',
      allowed_tables: ['orders'], max_rows: 10,
    });
    expect(ok.status(), await ok.text()).toBe(201);
  });

  test('S6-SEC-03 binding_config 内联凭证被拒（必须走 credential_id）', async ({ request }) => {
    const toolId = await newTool(request, await newPlugin(request, 'db'), 'db');
    const r = await newVersion(request, toolId, {
      query_template: 'select id from orders', allowed_tables: ['orders'], password: 'hunter2',
    });
    expect(r.status()).toBe(400);
    expect(await r.text()).toMatch(/凭证/);
  });

  test('S6-SEC-04 OpenAPI 导入不接受 URL 让服务端代拉（SSRF）', async ({ request }) => {
    const pluginId = await newPlugin(request, 'api');
    const r = await request.post(`/api/plugins/${pluginId}/import-openapi`, {
      data: { url: 'http://169.254.169.254/latest/meta-data/', allowedHosts: ['api.example.com'] },
    });
    expect(r.status()).toBe(400);
    expect(await r.text()).toMatch(/paths/);
  });

  test('S6-SEC-05 连通性测试需 tool:update 权限，只读角色拿不到', async ({ browser }) => {
    // 该接口会发起真实出站请求，只读权限的人不该能借平台探测网络
    const ctx = await browser.newContext({ storageState: storageStatePath('userA') });
    const r = await ctx.request.post('/api/tools/00000000-0000-4000-8000-000000000000/test', {
      data: { versionId: '00000000-0000-4000-8000-000000000000' },
    });
    expect(r.status()).toBe(403);
    await ctx.close();
  });

  // ── 连通性测试（V12-4.5）─────────────────────────────────────────────

  test('S6-TEST-01 连通性测试对不存在的版本给出明确结论，不是 500', async ({ request }) => {
    const toolId = await newTool(request, await newPlugin(request, 'api'), 'api');
    const r = await request.post(`/api/tools/${toolId}/test`, {
      data: { versionId: '00000000-0000-4000-8000-000000000000' },
    });
    // 调用失败是业务结论不是服务端错误：仍回 200，由结论字段表达成败
    expect(r.status()).toBe(200);
    const { result } = await r.json();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/不存在|无权访问/);
  });

  test('S6-TEST-02 MCP stdio 传输被明确拒绝并说明原因', async ({ request }) => {
    // 平台不 spawn 数据库里的任意 command —— 那等于任意代码执行。
    // 这条用例锁住"拒绝"这个行为本身，防止日后有人为了跑通而放开
    const pluginId = await newPlugin(request, 'mcp');
    const toolId = await newTool(request, pluginId, 'mcp');
    const v = await newVersion(request, toolId, { mcp_tool_name: 'search' });
    expect(v.status()).toBe(201);
    const versionId = (await v.json()).version.id;

    const r = await request.post(`/api/tools/${toolId}/test`, { data: { versionId } });
    expect(r.status()).toBe(200);
    const { result } = await r.json();
    expect(result.ok).toBe(false);
    // 没有 plugin_versions 时报"缺少连接信息"，有 stdio 时报"无法直接调用"，
    // 两者都是明确结论，不能是"测试失败"这种没信息量的话
    expect(result.message).toMatch(/连接信息|无法从平台直接调用/);
  });
});
