# AIPaddle 项目约定

## 权限与角色（开发必读，已确认冻结 v1.05）
- 规范文档：`docs/requirements/PRD_权限与角色_v1.05.md`（PRD 2.11 章节，合入 PRD_Core 下一版）
- 机器可读配置：`docs/requirements/permissions.config.json` —— 生成后端 RBAC 表结构、路由守卫、审批流时以此为准
- 要点：平台/租户两层角色；「受限访客」（原外包驻场）；Skill 三级（L1 企业强制 / L2 个人 / L3 审核上架）；WF·CF·Agent 以部门为单位共享、AI 管理员审核；企业级 Multi-Agent 仅系统管理员；知识库穿透默认「调用者权限继承」，交集校验；管理员角色变更双人复核

## 测试数据口径
- 主租户：北京品器资产管理有限公司（品器资产，t-001，企业版）；第二租户：华润三九医药股份有限公司（华润三九，t-005，专业版）
- 域名口径：@pinqi.cn / admin@999.com.cn；不再使用 示范科技 / 测试企业 / demo.com

## 原型结构
- 入口 `AIPaddle.dc.html`（hash 路由 #dashboard…#tenant-admin）；数据在 `data.js` / `data2.js`；图标组件 `licon.js`（shadow-DOM，勿改回 light-DOM 渲染）
- 确认页：`PRD确认清单.dc.html`、`权限角色确认.dc.html`（localStorage 记录确认结果）
