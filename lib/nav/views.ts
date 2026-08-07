// 顶部多窗口标签的视图名与标题解析（WF-19）。纯函数、零依赖，前后端与测试共用。
//
// view = 去掉前导斜杠的 pathname，例如 'workflows'、'workflows/9f3c-…'。

// 🔴 与 components/app-sidebar.tsx 的 href 保持一致：侧栏能到达的页面都必须能钉成标签，
// 漏登记的一律走不进标签条（`plugins/mcp` 这类二级 href 尤其容易漏）。
export const VIEW_TITLES: Record<string, string> = {
  dashboard: '监控',
  'agents-admin': 'Agent 管理',
  'skill-hub': 'Skill Hub',
  security: '安全管理',
  mcp: 'MCP 管理',
  workflows: '工作流管理',
  templates: '模板库',
  assistant: '个人助理',
  agents: '数字员工',
  members: '成员管理',
  'knowledge-admin': '知识库管理',
  tenants: '租户管理',
  knowledge: '知识库问答',
  'office-tools': '办公文件处理',
  'my-skills': '我的 Skill',
  'saas-dashboard': '运营看板',
  keys: 'Key 管理',
  billing: '账单管理',
  settings: '系统设置',
  'ai-activity': 'AI 操作记录',
  'agent-schedules': '定时作业',
  extensions: '扩展管理',
  plugins: 'Plugin 管理',
  'plugins/mcp': 'MCP',
  'plugins/api': 'API',
  'plugins/db': 'DB',
  'plugins/smtp': 'SMTP',
}

/**
 * 该视图能否钉成标签。
 *
 * 🔴 判定看**一级段**，不是整条路径：详情页 `/workflows/<id>` 之前因为整串不在
 * 白名单里被判为不可钉住，从个人助理自动跳过去的工作流编辑页压根不进标签条，
 * 切走就再也回不来。
 */
export function isPinnableView(view: string, titles: Record<string, string> = VIEW_TITLES): boolean {
  return view.split('/')[0] in titles
}

/**
 * 标签显示名。
 * 精确命中 → 用白名单名；详情页 → 「一级名 · 页面上报的名字」；
 * 没上报 → 「一级名 · 详情」；都认不出 → 原样回 view。
 */
export function resolveTabTitle(
  view: string,
  detailTitles: Record<string, string> = {},
  titles: Record<string, string> = VIEW_TITLES,
): string {
  const exact = titles[view]
  if (exact) return exact
  const parent = titles[view.split('/')[0]]
  const reported = detailTitles[view]
  if (reported) return parent ? `${parent} · ${reported}` : reported
  return parent ? `${parent} · 详情` : view
}
