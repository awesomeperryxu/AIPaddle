# Lovable 执行指南

## 核心策略

Lovable 会直接生成可运行的 React + Tailwind + shadcn/ui 代码。
**没有"仅 UX"模式**——但生成的代码本身就是可交互的 UX 原型。

### 工作流程

```
1. 创建 Lovable 项目，导入现有代码作为参考
2. 先发送 00_design-system.md（建立全局样式基准）
3. 逐页发送 prompt（01-11），每次生成一个页面
4. 在 Lovable 预览中确认 UX 交互
5. 满意后导出代码，合入 v0-ai-llmops-prototype 项目
```

### 操作步骤

**Step 1: 创建项目**
- 打开 https://lovable.dev
- 创建新项目
- 在初始 prompt 中粘贴 `00_design-system.md` 的全部内容

**Step 2: 提供现有代码参考**
- 将 v0-ai-llmops-prototype 项目的关键文件上传或粘贴给 Lovable：
  - `app/globals.css`（色彩 token）
  - `components/app-sidebar.tsx`（侧边栏）
  - `app/page.tsx`（主布局）
- 告诉 Lovable："请基于这些现有代码的样式和组件模式，生成后续页面"

**Step 3: 逐页生成**
- 按编号顺序发送每个 prompt 文件
- 每次发送后在预览中确认效果
- 如果不满意，在同一对话中追加调整指令

**Step 4: Workflow 编辑器（最复杂）**
- 分 3-4 次发送（列表页 → 画布主体 → 节点面板 → 调试面板）
- 每次确认后再发下一部分

### 文件列表

| 文件 | 内容 | 建议顺序 |
|------|------|---------|
| `00_design-system.md` | 设计系统 + 全局布局（每次新项目必须先发） | 第 1 步 |
| `01_dashboard.md` | 监控面板页面 | 第 2 步 |
| `02_agent-management.md` | Agent 管理页面 | 第 3 步 |
| `03_skill-hub.md` | Skill Hub 页面 | 第 4 步 |
| `04_workflow-list.md` | 工作流列表页（编辑器入口） | 第 5 步 |
| `05_workflow-editor.md` | 工作流编辑器画布 | 第 6 步 |
| `06_workflow-panels.md` | 编辑器面板（配置/调试/变量） | 第 7 步 |
| `07_workflow-interactions.md` | 编辑器交互（右键菜单/评论/协作） | 第 8 步 |
| `08_tenant-management.md` | 租户管理列表页 | 第 9 步 |
| `09_other-pages.md` | 其他页面（助理/安全/成员/知识库） | 第 10 步 |
| `10_saas-dashboard.md` | 运营看板（平台管理） | 第 11 步 |
| `11_key-management.md` | Key 管理（平台管理） | 第 12 步 |
| `12_billing.md` | 账单管理（平台管理） | 第 13 步 |
| `13_tenant-onboarding.md` | 开通企业流程（全屏表单） | 第 14 步 |
| `14_tenant-internal.md` | 租户内部管理（组织/人员/角色/访问/配额/审计） | 第 15 步 |

### 注意事项

- Lovable 使用 React + Vite（非 Next.js），路由方式不同但 UI 组件通用
- 如果 Lovable 生成的样式与现有项目不一致，粘贴 globals.css 让它对齐
- Workflow 编辑器建议使用 ReactFlow 库，在 prompt 中明确指定
