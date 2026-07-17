# AIPaddle

AIPaddle 是面向企业的 AI 业务赋能与 LLMOps 管理平台原型，用于统一展示和管理 Agent、Skill、知识库、Workflow、成员、安全审核与 SaaS 租户。

当前仓库定位是 **前端交互原型**：核心页面和部分本地交互已实现，数据来自 `lib/mock-data.ts`；认证、持久化 API、权限校验、工作流执行引擎和实时监控尚未接入。详细边界见 [`docs/IMPLEMENTATION_AUDIT.md`](docs/IMPLEMENTATION_AUDIT.md)。

## 技术栈

- Next.js 16、React 19、TypeScript
- Tailwind CSS 4、Radix UI / shadcn/ui
- Recharts、Lucide React
- pnpm

## 本地开发

```bash
pnpm install
pnpm dev
```

访问 <http://localhost:3000>。

## 质量检查

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## 产品与设计依据

- [`docs/requirements/PRD_Core_v1.04.md`](docs/requirements/PRD_Core_v1.04.md)
- [`docs/requirements/UI_Design_Spec_v1.04.md`](docs/requirements/UI_Design_Spec_v1.04.md)

后续功能开发以 PRD 为业务依据，以技术方案和审计报告记录的交付边界为准。
