# AIPaddle 测试流程说明书（自动执行协议）

> 版本 v1.0 · 2026-07-18
> 分工：`docs/TESTING.md` 定义**测什么**（六层测试）；本说明书定义**怎么自动执行**——每个 GitHub Issue 工作事项如何映射到测试内容、测试结果如何自动反馈进 Issue、不合格如何自动修复、用户测试环节如何调取 Codex 交叉测试。
> 执行主体：Claude Code（通过 `CLAUDE.md` 强制加载本协议）。GitHub Actions 提供兜底的自动 CI 层。

---

## 1. Issue 工作事项 → 测试内容映射

每个 Issue 创建时必须打**类型标签**（四选一）+ 需要时叠加**专项标签**。标签决定自动调取哪些测试：

| 标签 | 适用工作事项 | 自动调取的测试集 |
|------|-------------|-----------------|
| `type:ui` | 纯界面/样式/文案 | L1 静态检查；涉及用户路径变化时加跑 Playwright 冒烟。单元测试可豁免（须在 Issue 注明） |
| `type:logic` | 业务逻辑：状态机、权限矩阵、工具函数、数据转换 | L1 + L2 单元测试（新逻辑必须先有测试） |
| `type:api` | API 路由、数据层、数据库迁移 | L1 + L2 + L3 集成测试（每个接口跑"四件套"：正常入参 / 非法入参 / 无权限 / 跨租户） |
| `type:infra` | 构建、部署、CI、环境配置 | L1 + 部署后冒烟（curl 健康检查） |
| `flag:tenant-data`（叠加） | 任何触碰租户数据的任务 | 必须加跑 L5① 租户隔离专项脚本 |
| `flag:rag`（叠加） | 检索、提示词、模型调用逻辑 | 必须加跑 L5② 金标准问答集评测（通过率 ≥80%） |
| `type:slice-acceptance` | 每个切片的收尾验收 Issue | L4 全量冒烟集 + 所有相关专项 + Codex 交叉测试（必做）+ 用户验收 |

**判定规则**：Claude Code 领取 Issue 时先核对标签与改动内容是否相符；改动超出标签范围（如 `type:ui` 的任务改到了 API），必须先向用户报告并补标签，再按合并后的测试集执行。判断不了类型 → 问用户，不猜。

---

## 2. 单个 Issue 的自动测试执行流程

Claude Code 处理每个 Issue 时按以下协议执行（对应 Issue 模板 9 步中的第 3-6 步的自动化细化）：

```
① gh issue view <N>            读取任务、验收标准、标签
② 向用户复述任务+将自动调取的测试集，确认后开发
③ 开发完成 → 按标签映射依次执行测试集
④ 生成测试报告 → gh issue comment 自动回帖（模板见附录 A）
⑤ 全绿 → 进入交叉测试/用户验收环节（§4）
   有红 → 进入自动修复循环（§3）
```

测试命令按映射自动选取：

```bash
pnpm check                                   # 所有类型必跑
pnpm test -- --changed                       # type:logic / type:api（相关单测+集成）
pnpm test:e2e --grep @smoke                  # 涉及用户路径 / slice-acceptance
pnpm test:isolation                          # flag:tenant-data（租户隔离专项）
pnpm test:rag-eval                           # flag:rag（金标准评测）
```

（后三个脚本随 ROADMAP 0.9 / 3.7 / 4.2 建立，建立前该项测试以"手动执行 + 报告注明"代替。）

---

## 3. 不合格的自动修复循环

测试有红时，Claude Code 自动进入修复循环，**最多 3 轮**：

```
第 X 轮（X ≤ 3）：
  1. 分析失败原因（读报错、定位代码）
  2. 修复
  3. 重跑该 Issue 映射的【全部】测试集（不能只跑失败那条，防止修 A 坏 B）
  4. gh issue comment 追加本轮记录：失败原因 → 改动内容 → 重测结果
全绿 → 退出循环，进入 §4
第 3 轮仍红 → 停止修复，Issue 打上 status:blocked 标签，
              汇报用户：失败现象、已尝试的 3 种修法、建议方向，等用户裁决
```

修复循环三条铁律：

1. **只修代码，不改测试**。测试断言不许为了变绿而放宽；确认是测试本身写错时，须在 Issue 中说明并经用户同意后才能改。
2. **不许跳过/删除/注释掉测试**（`.skip`、`--exclude` 一律禁止）。
3. **修复不许扩大范围**：只改与失败直接相关的代码；顺手发现的其他问题记入 Issue「遗留问题」栏另建卡。

---

## 4. 用户测试环节：Codex 交叉测试

**目的**：用户手动验收前，由另一个独立 AI（OpenAI Codex CLI）以对抗视角复核 Claude Code 的工作，防止"运动员兼裁判"。

**时机**：自动测试全绿之后、用户手动验收（Issue 第 7 步）之前。`type:slice-acceptance` 的 Issue **必做**；普通 Issue 默认做，用户说"跳过交叉"即可跳过。

**前提**：本机已安装并登录 Codex CLI（`codex --version` 可验证）。未安装时此环节降级为 Claude Code 自查清单 + 报告注明"未做交叉"。

**流程**：

```
① Claude Code 生成交叉测试指令并调取 Codex（只读审查模式）：
   codex exec "你是本 PR 的对抗性审查者。任务背景：<Issue 标题+验收标准>。
   请：1) git diff main...<branch> 审查全部改动；
       2) 独立运行 pnpm check 与 pnpm test 验证；
       3) 从边界条件、安全、租户隔离、验收标准是否真正满足四个角度找问题；
       4) 输出问题清单，每条给出严重程度与复现方式。不要修改任何代码。"
② Codex 报告存入 docs/reviews/issue-<N>-codex.md，
   摘要以评论贴进 Issue（模板见附录 B）
③ 分歧处理：Codex 提出的每条问题，Claude Code 必须逐条回应——
   确认的 → 回到 §3 修复循环；有依据反驳的 → 写明理由；
   双方僵持的 → 交用户裁决
④ 全部问题闭环后，才请求用户手动验收；
   用户验收时可参考 Codex 报告作为独立第二意见
```

**边界约定**：Codex 只读不写——不允许 Codex 直接修改代码，所有修复仍由 Claude Code 执行，避免两个 AI 互相覆盖对方改动造成混乱。

---

## 5. 阶段级用户测试（真实用户，L6②）

每个阶段/大切片完成后：

1. 前置条件：冒烟集全绿 + slice-acceptance Issue 已闭环（含 Codex 交叉报告）
2. Claude Code 生成《用户测试任务卡》：给真实用户的 3-5 个任务（只给目标，不给操作指导）
3. 你观察 3-5 个用户执行，每人记一页笔记（卡点/疑问/未用功能/原话）
4. 笔记汇总建一个 `user-feedback` 标签的 Issue，Claude Code 把反馈拆解为新任务 Issue，进入下一轮循环

---

## 6. GitHub Actions 兜底层

本说明书的自动测试由 Claude Code 在开发会话中执行；`.github/workflows/ci.yml` 是不依赖会话的兜底：每次 push 自动跑 L1（+0.9 后的 L2/L3），PR 合并 main 前跑冒烟。**CI 红灯优先级高于一切新任务。** CI 失败时 GitHub 会在 PR 页自动标红并邮件通知你。

---

## 附录 A：测试结果评论模板（贴进 Issue）

```markdown
## 🧪 自动测试报告（第 X 次）
**Issue**：#N [编号] 任务名 ｜ **分支**：feat/xxx ｜ **执行**：Claude Code
| 测试集 | 结果 | 明细 |
|--------|------|------|
| L1 pnpm check | ✅/❌ | 错误摘要或"通过" |
| L2/L3 pnpm test | ✅/❌/– | X 通过 / Y 失败（– = 本类型豁免） |
| L4 冒烟集 | ✅/❌/– | |
| L5 专项 | ✅/❌/– | 隔离/RAG 评测结果 |
**结论**：全绿，待交叉测试与用户验收 ／ 有红，进入自动修复第 X 轮
```

## 附录 B：Codex 交叉测试评论模板

```markdown
## 🔍 Codex 交叉测试报告
**完整报告**：docs/reviews/issue-N-codex.md
**Codex 独立跑测试**：✅ 复现全绿 / ❌ 未能复现
**发现问题**：共 X 条（严重 A / 一般 B / 建议 C）
1. [严重] …… → Claude 回应：已修复（commit abc123）
2. [建议] …… → Claude 回应：不采纳，理由……
**状态**：全部闭环 ✅，可进入用户验收
```

## 附录 C：常用命令速查

```bash
gh issue view <N>                        # 读任务
gh issue comment <N> --body-file r.md    # 回帖测试报告
gh issue edit <N> --add-label status:blocked
codex --version                          # 检查 Codex CLI
codex exec "<审查指令>"                  # 调取交叉测试
```
