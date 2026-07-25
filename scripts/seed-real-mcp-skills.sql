-- ============================================================================
-- seed-real-mcp-skills.sql
-- 用途：将 AIPaddle 平台 Skill Hub 从「虚构示例」切换为「真实开源高星 MCP server」预设。
--   ADR-004：能力封装为 Skill；本脚本让平台可选 Skill 对齐真实 MCP 生态。
--
-- 目标组织 org_id       = 22f72480-222b-46ae-b0ea-00603b27581b（生产 demo 组织）
-- 平台发布者 publisher_id = 71c298bb-80ef-47ee-b940-16009e929a16（dev@aipaddle.dev）
--
-- 两段：
--   任务 A：软删 15 个虚构可选平台 skill（deleted_at=now()）；
--           保留 3 个 mandatory=true 强制治理 skill（企业统一认证/操作审计留痕/数据合规检查）。
--   任务 B：INSERT 25 个真实、可落地、GitHub 高星的企业通用 MCP skill
--           （origin='platform', mandatory=false, type='MCP', status='published'）。
--
-- 星数与仓库全名均已于 2026-07-25 逐个 WebFetch/WebSearch 核实（config.stars 为实测约值）。
-- 密钥类只列 env 变量名，绝不写真实值。id 用默认 gen_random_uuid()。
-- documentation 用 dollar-quoted $md$...$md$；config 用 '...'::jsonb。
--
-- 执行（单事务，遇错即停）：
--   psql "$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f scripts/seed-real-mcp-skills.sql
-- 干跑（不落库）：
--   begin; \i scripts/seed-real-mcp-skills.sql; rollback;
--
-- 替换说明（原目标清单中 3 项无高星开源实现 + 1 项仅远程官方，已按「同类高星」调整并注明）：
--   · SQLite       → MongoDB（mongodb-js/mongodb-mcp-server 官方，Apache-2.0）—— SQLite 参考实现已 archived、无高星。
--   · Google Maps  → Grafana（grafana/mcp-grafana 官方，可观测性）—— 无高星地图类 MCP，改配同为运维数据类高星官方件。
--   · Google Drive → Figma（GLips/Figma-Context-MCP，15.5k★，设计协作）—— gdrive 参考实现已 archived、无高星。
--   · Linear       → 保留，但采用官方远程 MCP（mcp.linear.app，OAuth），无单一高星仓库，config.stars 记为 null。
-- ============================================================================

-- ============================================================================
-- 任务 A：软删 15 个虚构可选平台 skill（不动 3 个 mandatory=true）
-- ============================================================================
update public.skills
set deleted_at = now()
where org_id = '22f72480-222b-46ae-b0ea-00603b27581b'
  and origin = 'platform'
  and mandatory = false
  and deleted_at is null
  and name in (
    '天气查询','汇率换算','邮件发送','日历排期','翻译助手',
    '舆情监控','库存查询','物流轨迹','数据库只读查询','客户画像',
    'PDF文本提取','企业微信通知','会议纪要','发票识别','图片OCR'
  );

-- ============================================================================
-- 任务 B：INSERT 25 个真实开源 MCP skill
-- ============================================================================

-- 1. 浏览器自动化 (Playwright)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '浏览器自动化 (Playwright)',
  '微软官方 MCP，用无障碍树驱动真实浏览器完成导航、点击、填表、截图与端到端测试。',
  'MCP', '1.0.0', 'medium', 'published',
  ARRAY['浏览器','自动化','测试','微软','网页操作'],
  'platform', false,
  '{"repo":"microsoft/playwright-mcp","stars":35000,"transport":"stdio","command":"npx -y @playwright/mcp@latest","tools":["browser_navigate","browser_click","browser_type","browser_fill_form","browser_snapshot","browser_take_screenshot","browser_evaluate","browser_wait_for"],"env":[],"docs_url":"https://github.com/microsoft/playwright-mcp","license":"Apache-2.0"}'::jsonb,
  $md$# 浏览器自动化 (Playwright)

> 微软官方出品的 Playwright MCP：让 AI 用结构化的无障碍树（而非截图猜坐标）稳定操控 Chromium/Firefox/WebKit。

## 开源出处
- 仓库：microsoft/playwright-mcp（约 35,000★）
- 链接：https://github.com/microsoft/playwright-mcp
- 许可：Apache-2.0

## 用途
企业里用它做无人值守的网页操作与回归：批量登录后台抓取数据、自动填报表单、跑端到端 UI 测试、对竞品页面做定时巡检截图。基于无障碍快照定位元素，比传统的像素点选更稳、更可解释。

## 提供的工具（Tools）
- `browser_navigate` — 打开指定 URL
- `browser_click` — 点击页面元素
- `browser_type` — 向输入框键入文本
- `browser_fill_form` — 一次性填写整张表单
- `browser_snapshot` — 抓取当前页面的无障碍结构快照（定位依据）
- `browser_take_screenshot` — 截图
- `browser_evaluate` — 在页面上下文执行 JS
- `browser_wait_for` — 等待文本/元素出现

## 接入方式
```bash
# stdio 本地启动，无需密钥
npx -y @playwright/mcp@latest
# 可选 --headless / --device 等参数控制运行模式
```

## 调用示例
「打开我们后台的订单页，登录后把今天的待发货订单导出成表格并截图给我。」

## 权限与风险
可执行任意点击/输入/JS，属**写操作**，建议在隔离环境或专用测试账号下运行；不要把生产管理员凭据交给它。默认无密钥，凭据经由被操作站点的登录流程注入，最小权限原则下用只读或受限账号。
$md$
);

-- 2. 代码仓库协作 (GitHub)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '代码仓库协作 (GitHub)',
  'GitHub 官方 MCP，查代码、搜提交、开/改 Issue 与 PR、看 Actions 与安全告警，直连研发流。',
  'MCP', '1.0.0', 'medium', 'published',
  ARRAY['代码仓库','GitHub','研发协作','Issue','CI'],
  'platform', false,
  '{"repo":"github/github-mcp-server","stars":31700,"transport":"stdio","command":"docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server","remote_url":"https://api.githubcopilot.com/mcp/","tools":["get_file_contents","search_code","list_commits","create_issue","update_issue","create_pull_request","merge_pull_request","list_workflow_runs"],"env":["GITHUB_PERSONAL_ACCESS_TOKEN"],"docs_url":"https://github.com/github/github-mcp-server","license":"MIT"}'::jsonb,
  $md$# 代码仓库协作 (GitHub)

> GitHub 官方 MCP server，把仓库、Issue、PR、Actions、代码安全全部接入对话式工作流。

## 开源出处
- 仓库：github/github-mcp-server（约 31,700★）
- 链接：https://github.com/github/github-mcp-server
- 许可：MIT

## 用途
研发团队用它把「读代码 + 提 Issue + 开 PR + 看 CI」搬进 AI 助手：让 AI 检索历史提交定位引入 bug 的改动、根据讨论自动建 Issue、把改动整理成 PR、汇总 Actions 失败原因、扫 Dependabot/代码扫描告警。

## 提供的工具（Tools）
- `get_file_contents` — 读取文件或目录内容
- `search_code` — 跨仓库搜索代码
- `list_commits` — 列提交历史
- `create_issue` / `update_issue` — 建/改 Issue
- `create_pull_request` — 建 PR
- `merge_pull_request` — 合并 PR
- `list_workflow_runs` — 查看 Actions 运行

## 接入方式
```bash
# 本地 Docker（推荐）
docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server
# 或直接连官方远程： https://api.githubcopilot.com/mcp/
```
需要环境变量 `GITHUB_PERSONAL_ACCESS_TOKEN`（细粒度 PAT）。

## 调用示例
「帮我在 acme/backend 仓库建一个 Issue：登录接口偶发 500，并贴上最近三条相关提交。」

## 权限与风险
建/改 Issue、开合 PR 属**写操作**。企业内建议签发**细粒度 PAT**，只授予必要仓库与最小 scope（如仅 issues:write / pull_requests:write），避免给 admin 或 org 级权限。
$md$
);

-- 3. 文件读写 (Filesystem)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '文件读写 (Filesystem)',
  'Anthropic 参考实现，在白名单目录内安全读写、检索、移动文件，是本地资料处理的基座。',
  'MCP', '1.0.0', 'medium', 'published',
  ARRAY['文件','本地资料','读写','检索','Anthropic'],
  'platform', false,
  '{"repo":"modelcontextprotocol/servers","stars":88900,"transport":"stdio","command":"npx -y @modelcontextprotocol/server-filesystem /path/to/allowed/dir","tools":["read_file","read_multiple_files","write_file","edit_file","create_directory","list_directory","move_file","search_files","get_file_info"],"env":[],"docs_url":"https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem","license":"MIT"}'::jsonb,
  $md$# 文件读写 (Filesystem)

> Anthropic 官方参考 server 之一：带访问控制的安全文件操作，只在你允许的目录内活动。

## 开源出处
- 仓库：modelcontextprotocol/servers（约 88,900★，Anthropic 官方参考集）
- 链接：https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem
- 许可：MIT

## 用途
让 AI 在受限白名单目录里处理本地资料：整理下载文件夹、批量重命名、在一堆文档里检索关键字、把生成的报告写盘、跨目录搬运素材。是「本地知识/文件工作流」的地基能力。

## 提供的工具（Tools）
- `read_file` / `read_multiple_files` — 读取一个/多个文件
- `write_file` — 写入（覆盖）文件
- `edit_file` — 基于文本匹配做局部修改
- `create_directory` — 建目录
- `list_directory` — 列目录
- `move_file` — 移动/重命名
- `search_files` — 按名递归搜索
- `get_file_info` — 查看文件元信息

## 接入方式
```bash
# 启动时把「允许访问的目录」作为参数传入，目录外一律拒绝
npx -y @modelcontextprotocol/server-filesystem /Users/you/workspace
```

## 调用示例
「把 workspace/reports 里所有 2026 年 Q2 的 md 文件汇总成一份总览，写到 summary.md。」

## 权限与风险
可**写/覆盖/移动**文件，属写操作。风险边界由启动参数里的白名单目录决定——务必只放业务目录，绝不传 `/` 或家目录根；容器化运行、挂载只必要卷更安全。
$md$
);

-- 4. 版本控制 (Git)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '版本控制 (Git)',
  'Anthropic 参考实现，读写本地 Git 仓库：查状态、看 diff、提交、建分支、翻历史。',
  'MCP', '1.0.0', 'medium', 'published',
  ARRAY['Git','版本控制','提交','分支','Anthropic'],
  'platform', false,
  '{"repo":"modelcontextprotocol/servers","stars":88900,"transport":"stdio","command":"uvx mcp-server-git --repository /path/to/repo","tools":["git_status","git_diff","git_add","git_commit","git_log","git_create_branch","git_checkout","git_show"],"env":[],"docs_url":"https://github.com/modelcontextprotocol/servers/tree/main/src/git","license":"MIT"}'::jsonb,
  $md$# 版本控制 (Git)

> Anthropic 官方参考 server：直接在本地 Git 仓库里读写，把版本操作交给 AI。

## 开源出处
- 仓库：modelcontextprotocol/servers（约 88,900★，Anthropic 官方参考集）
- 链接：https://github.com/modelcontextprotocol/servers/tree/main/src/git
- 许可：MIT

## 用途
配合「文件读写」使用，让 AI 完成本地版本管理闭环：查看工作区状态与 diff、把改动分组提交并写规范的提交信息、拉功能分支、检出、回看某次提交的完整改动。适合自动化脚手架、批量改动的可追溯落盘。

## 提供的工具（Tools）
- `git_status` — 查看工作区状态
- `git_diff` — 查看未暂存/已暂存差异
- `git_add` — 暂存改动
- `git_commit` — 提交
- `git_log` — 翻提交历史
- `git_create_branch` — 建分支
- `git_checkout` — 检出分支
- `git_show` — 查看某次提交详情

## 接入方式
```bash
# Python 实现，用 uvx 启动，--repository 指定仓库路径
uvx mcp-server-git --repository /Users/you/workspace/repo
```

## 接入示例
「把当前所有改动按功能分成两次提交，提交信息用中文写清楚做了什么。」

## 权限与风险
`git_commit` 等属**写操作**，会改动仓库历史。建议只对**功能分支**放开、主分支加保护；不要让它执行 push（本 server 聚焦本地操作，远程推送另由 GitHub skill 或人工把关）。
$md$
);

-- 5. 网页抓取 (Fetch)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '网页抓取 (Fetch)',
  'Anthropic 参考实现，抓取网页并转成干净 Markdown 喂给模型，轻量只读。',
  'MCP', '1.0.0', 'low', 'published',
  ARRAY['网页','抓取','Markdown','只读','Anthropic'],
  'platform', false,
  '{"repo":"modelcontextprotocol/servers","stars":88900,"transport":"stdio","command":"uvx mcp-server-fetch","tools":["fetch"],"env":[],"docs_url":"https://github.com/modelcontextprotocol/servers/tree/main/src/fetch","license":"MIT"}'::jsonb,
  $md$# 网页抓取 (Fetch)

> Anthropic 官方参考 server：把指定 URL 的网页抓下来并转成精简 Markdown，供模型高效阅读。

## 开源出处
- 仓库：modelcontextprotocol/servers（约 88,900★，Anthropic 官方参考集）
- 链接：https://github.com/modelcontextprotocol/servers/tree/main/src/fetch
- 许可：MIT

## 用途
最轻量的「读一个网页」能力：让 AI 读取一篇公开文档/文章/API 页面，去掉导航与噪声后转成 Markdown 再总结。适合快速引用一个已知链接的内容，是不需要搜索引擎时的低成本取数方式。

## 提供的工具（Tools）
- `fetch` — 抓取 URL，返回转换后的 Markdown；支持分段读取（start_index）与原始 HTML 选项

## 接入方式
```bash
# Python 实现，uvx 启动，无需密钥
uvx mcp-server-fetch
```

## 调用示例
「读一下这篇发布说明 https://example.com/changelog ，帮我提炼这次版本的三个关键变化。」

## 权限与风险
**只读**，无写操作、无密钥，风险低。注意两点：一是会发起对外 HTTP 请求，内网部署时按需配置出网代理与目标白名单；二是它默认遵守 robots，抓取第三方站点仍需遵守对方条款。
$md$
);

-- 6. 长期记忆 (Memory)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '长期记忆 (Memory)',
  'Anthropic 参考实现，用知识图谱把实体与关系持久化，给 AI 跨会话的长期记忆。',
  'MCP', '1.0.0', 'low', 'published',
  ARRAY['记忆','知识图谱','持久化','上下文','Anthropic'],
  'platform', false,
  '{"repo":"modelcontextprotocol/servers","stars":88900,"transport":"stdio","command":"npx -y @modelcontextprotocol/server-memory","tools":["create_entities","create_relations","add_observations","delete_entities","read_graph","search_nodes","open_nodes"],"env":["MEMORY_FILE_PATH"],"docs_url":"https://github.com/modelcontextprotocol/servers/tree/main/src/memory","license":"MIT"}'::jsonb,
  $md$# 长期记忆 (Memory)

> Anthropic 官方参考 server：基于知识图谱的持久化记忆，让 AI 记住跨会话的人、事、偏好与关系。

## 开源出处
- 仓库：modelcontextprotocol/servers（约 88,900★，Anthropic 官方参考集）
- 链接：https://github.com/modelcontextprotocol/servers/tree/main/src/memory
- 许可：MIT

## 用途
给 AI 助手一块结构化的长期记忆：把用户偏好、项目背景、客户关系、决策结论沉淀成「实体 + 关系 + 观察」的知识图谱，下次对话直接检索复用，避免每次从零交代上下文。适合做企业内的助理记忆层。

## 提供的工具（Tools）
- `create_entities` — 新建实体（人/项目/概念…）
- `create_relations` — 建立实体间关系
- `add_observations` — 给实体追加事实观察
- `delete_entities` — 删除实体
- `read_graph` — 读取整张图
- `search_nodes` — 按关键词检索节点
- `open_nodes` — 打开指定节点详情

## 接入方式
```bash
npx -y @modelcontextprotocol/server-memory
# 可用 MEMORY_FILE_PATH 指定图谱持久化文件位置
```

## 调用示例
「记住：这个客户对交付时间很敏感，负责人是张总，之前因为延期投诉过一次。」

## 权限与风险
读写的是**本地记忆文件**、不触达业务系统，风险低。注意别把敏感个人信息（PII）无节制写入，记忆文件应纳入与业务数据同级的访问控制与合规审查。
$md$
);

-- 7. 结构化推理 (Sequential Thinking)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '结构化推理 (Sequential Thinking)',
  'Anthropic 参考实现，把复杂问题拆成可回溯、可修正的思考步骤，无任何副作用。',
  'MCP', '1.0.0', 'low', 'published',
  ARRAY['推理','思维链','规划','复杂问题','Anthropic'],
  'platform', false,
  '{"repo":"modelcontextprotocol/servers","stars":88900,"transport":"stdio","command":"npx -y @modelcontextprotocol/server-sequential-thinking","tools":["sequentialthinking"],"env":[],"docs_url":"https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking","license":"MIT"}'::jsonb,
  $md$# 结构化推理 (Sequential Thinking)

> Anthropic 官方参考 server：把一个难题拆成一串可分支、可回退、可修正的思考步骤，让推理过程显式化。

## 开源出处
- 仓库：modelcontextprotocol/servers（约 88,900★，Anthropic 官方参考集）
- 链接：https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking
- 许可：MIT

## 用途
面向需要多步规划或严谨拆解的任务：方案设计、根因分析、复杂决策。它引导模型一步步推进，允许中途否定前一步、开分支比较、动态增减步骤，最后收敛出结论。适合把「拍脑袋」变成「可审查的推理链」。

## 提供的工具（Tools）
- `sequentialthinking` — 提交/推进一步思考，可标注是否为修正、是否分支、还需几步

## 接入方式
```bash
# 纯推理编排，无外部依赖、无密钥
npx -y @modelcontextprotocol/server-sequential-thinking
```

## 调用示例
「用结构化推理帮我评估：把订单服务从单体拆成微服务，值不值得，分步论证。」

## 权限与风险
**无任何副作用**：不读文件、不发请求、不写数据，只组织思考过程，风险最低。唯一成本是会增加 token 消耗，简单问题上不必启用。
$md$
);

-- 8. 时间与时区 (Time)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '时间与时区 (Time)',
  'Anthropic 参考实现，取当前时间、跨时区换算，给排期与跨国协作提供可靠时间基准。',
  'MCP', '1.0.0', 'low', 'published',
  ARRAY['时间','时区','换算','排期','Anthropic'],
  'platform', false,
  '{"repo":"modelcontextprotocol/servers","stars":88900,"transport":"stdio","command":"uvx mcp-server-time","tools":["get_current_time","convert_time"],"env":[],"docs_url":"https://github.com/modelcontextprotocol/servers/tree/main/src/time","license":"MIT"}'::jsonb,
  $md$# 时间与时区 (Time)

> Anthropic 官方参考 server：查当前时间、做时区换算，给 AI 一个可靠的时间与日历基准。

## 开源出处
- 仓库：modelcontextprotocol/servers（约 88,900★，Anthropic 官方参考集）
- 链接：https://github.com/modelcontextprotocol/servers/tree/main/src/time
- 许可：MIT

## 用途
解决模型「不知道现在几点、算不准时差」的老问题。跨国团队排会、把客户所在时区换算成本地时间、给日报盖上准确时间戳时都会用到。是很多排期/提醒类工作流的底层依赖。

## 提供的工具（Tools）
- `get_current_time` — 获取指定时区的当前时间
- `convert_time` — 在两个时区之间换算某一时刻

## 接入方式
```bash
# Python 实现，uvx 启动，无需密钥
uvx mcp-server-time
# 可用 --local-timezone 指定默认本地时区
```

## 调用示例
「深圳时间明天上午 10 点，对应旧金山和伦敦分别是几点？帮我列出来。」

## 权限与风险
**只读**、无外部依赖、无密钥，风险最低。返回结果依赖运行环境的时区数据库（IANA tz），保持系统 tzdata 更新即可。
$md$
);

-- 9. PostgreSQL 数据库 (Postgres MCP Pro)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  'PostgreSQL 数据库 (Postgres MCP Pro)',
  '开源高星 Postgres MCP，读写可配、能解释执行计划、给索引与健康度诊断建议。',
  'MCP', '1.0.0', 'medium', 'published',
  ARRAY['数据库','PostgreSQL','SQL','性能诊断','索引'],
  'platform', false,
  '{"repo":"crystaldba/postgres-mcp","stars":3100,"transport":"stdio","command":"uvx postgres-mcp --access-mode=restricted","tools":["list_schemas","list_objects","get_object_details","execute_sql","explain_query","get_top_queries","analyze_workload_indexes","analyze_db_health"],"env":["DATABASE_URI"],"docs_url":"https://github.com/crystaldba/postgres-mcp","license":"MIT"}'::jsonb,
  $md$# PostgreSQL 数据库 (Postgres MCP Pro)

> 社区高星的 Postgres MCP：不止能跑 SQL，还能解释执行计划、给索引优化和数据库健康度诊断。

## 开源出处
- 仓库：crystaldba/postgres-mcp（约 3,100★）
- 链接：https://github.com/crystaldba/postgres-mcp
- 许可：MIT
- 说明：Anthropic 早期的 postgres 参考实现已归档，本项目为当前活跃维护的高星替代。

## 用途
让 AI 直接对接企业 Postgres：自然语言查数、审查慢查询、解释某条 SQL 为什么慢、给出该建哪些索引、体检整库健康状况（膨胀、连接、缓存命中）。支持受限只读模式与不受限读写模式，适配开发调试到生产诊断的不同场景。

## 提供的工具（Tools）
- `list_schemas` / `list_objects` / `get_object_details` — 浏览库结构
- `execute_sql` — 执行 SQL（受访问模式约束）
- `explain_query` — 查看执行计划
- `get_top_queries` — 找最耗资源的查询
- `analyze_workload_indexes` — 基于负载给索引建议
- `analyze_db_health` — 数据库健康体检

## 接入方式
```bash
# 生产环境务必用受限模式（只读）
uvx postgres-mcp --access-mode=restricted
# 连接串放环境变量
export DATABASE_URI="postgresql://user:pass@host:5432/dbname"
```

## 权限与风险
不受限模式下 `execute_sql` 可**写库/改结构**，属高影响写操作。企业内强烈建议：生产用 `--access-mode=restricted` 只读、连**只读副本**、账号仅授予必要库表的 SELECT；写操作单独走受控流程。连接串含密码，只放服务端环境变量。
$md$
);

-- 10. MongoDB 数据库 (MongoDB MCP)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  'MongoDB 数据库 (MongoDB MCP)',
  'MongoDB 官方 MCP，查询聚合文档、管理集合与索引、操作 Atlas 集群，支持只读模式。',
  'MCP', '1.0.0', 'medium', 'published',
  ARRAY['数据库','MongoDB','Atlas','文档','NoSQL'],
  'platform', false,
  '{"repo":"mongodb-js/mongodb-mcp-server","stars":1100,"transport":"stdio","command":"npx -y mongodb-mcp-server@latest --readOnly","tools":["find","aggregate","insert-many","update-many","delete-many","list-databases","list-collections","collection-indexes","db-stats","atlas-list-clusters"],"env":["MDB_MCP_CONNECTION_STRING"],"docs_url":"https://github.com/mongodb-js/mongodb-mcp-server","license":"Apache-2.0"}'::jsonb,
  $md$# MongoDB 数据库 (MongoDB MCP)

> MongoDB 官方 MCP server：对接文档数据库与 Atlas 云服务，查询、聚合、管理一站到位。

## 开源出处
- 仓库：mongodb-js/mongodb-mcp-server（约 1,100★，MongoDB 官方）
- 链接：https://github.com/mongodb-js/mongodb-mcp-server
- 许可：Apache-2.0
- 说明：替代原目标清单中的 SQLite（其参考实现已归档、无高星），改配为官方维护的高质量文档数据库 MCP。

## 用途
让 AI 直连 MongoDB / Atlas：用自然语言查文档、跑聚合管道分析、查看集合与索引、统计库状态，运维层面还能列/看 Atlas 集群。适合以 MongoDB 为主存的业务做数据探查与轻量运维。

## 提供的工具（Tools）
- `find` — 按条件查询文档
- `aggregate` — 运行聚合管道
- `insert-many` / `update-many` / `delete-many` — 增改删文档
- `list-databases` / `list-collections` — 列库与集合
- `collection-indexes` — 查看索引
- `db-stats` — 库统计
- `atlas-list-clusters` — 列 Atlas 集群

## 接入方式
```bash
# 建议加 --readOnly 只读；写场景去掉该标志并配受控账号
npx -y mongodb-mcp-server@latest --readOnly
export MDB_MCP_CONNECTION_STRING="mongodb+srv://user:pass@cluster.mongodb.net/"
```

## 权限与风险
默认可执行 `insert/update/delete` 等**写操作**，Atlas 工具还能触达云资源。企业内建议：分析场景一律加 `--readOnly`；写操作用最小权限的专用数据库用户；连接串只放服务端环境变量，不进前端与 git。
$md$
);

-- 11. Supabase 后端 (Supabase MCP)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  'Supabase 后端 (Supabase MCP)',
  'Supabase 官方 MCP，管理项目、跑 SQL、应用迁移、查表结构与扩展，直连你的后端。',
  'MCP', '1.0.0', 'high', 'published',
  ARRAY['Supabase','数据库','后端','迁移','项目管理'],
  'platform', false,
  '{"repo":"supabase-community/supabase-mcp","stars":2800,"transport":"stdio","command":"npx -y @supabase/mcp-server-supabase@latest --read-only","tools":["list_projects","get_project","list_tables","execute_sql","apply_migration","list_extensions","create_branch"],"env":["SUPABASE_ACCESS_TOKEN"],"docs_url":"https://github.com/supabase-community/supabase-mcp","license":"Apache-2.0"}'::jsonb,
  $md$# Supabase 后端 (Supabase MCP)

> Supabase 官方 MCP server：把项目管理、SQL 执行、数据库迁移全接入 AI 工作流。

## 开源出处
- 仓库：supabase-community/supabase-mcp（约 2,800★，Supabase 官方）
- 链接：https://github.com/supabase-community/supabase-mcp
- 许可：Apache-2.0

## 用途
以 Supabase 为后端的团队用它做全生命周期操作：列项目、查表结构、跑 SQL 取数、应用数据库迁移、查看已装扩展、开发用分支。把「登控制台点来点去」变成对话式操作，尤其适配本平台自身（AIPaddle 基座即 Supabase）。

## 提供的工具（Tools）
- `list_projects` / `get_project` — 列/查项目
- `list_tables` — 查表结构
- `execute_sql` — 执行 SQL
- `apply_migration` — 应用迁移（DDL）
- `list_extensions` — 查看扩展
- `create_branch` — 创建开发分支

## 接入方式
```bash
# 强烈建议加 --read-only；写/迁移场景再单独放开
npx -y @supabase/mcp-server-supabase@latest --read-only
export SUPABASE_ACCESS_TOKEN="<个人访问令牌>"
```

## 权限与风险
`apply_migration` 会**改数据库结构**、`execute_sql` 可写数据，均属高影响操作。访问令牌等同项目控制权，务必：默认 `--read-only`、用 `--project-ref` 限定单项目、令牌只放服务端；生产库的迁移必须走人工复核，不交给 AI 自动落库。
$md$
);

-- 12. 电子表格 (Excel MCP)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '电子表格 (Excel)',
  '高星开源 Excel MCP，无需装 Office 即可读写单元格、套公式、做图表与数据透视表。',
  'MCP', '1.0.0', 'medium', 'published',
  ARRAY['Excel','表格','公式','图表','报表'],
  'platform', false,
  '{"repo":"haris-musa/excel-mcp-server","stars":4000,"transport":"stdio","command":"uvx excel-mcp-server stdio","tools":["read_data_from_excel","write_data_to_excel","create_workbook","create_worksheet","apply_formula","format_range","create_chart","create_pivot_table"],"env":["EXCEL_FILES_PATH"],"docs_url":"https://github.com/haris-musa/excel-mcp-server","license":"MIT"}'::jsonb,
  $md$# 电子表格 (Excel)

> 高星开源 Excel MCP：不依赖本机 Microsoft Office，直接读写 .xlsx，连公式、图表、透视表都能生成。

## 开源出处
- 仓库：haris-musa/excel-mcp-server（约 4,000★）
- 链接：https://github.com/haris-musa/excel-mcp-server
- 许可：MIT

## 用途
把「做表」自动化：读取现有报表数据、按模板批量填数、写入带公式的计算列、套用格式、生成图表和数据透视表。财务、运营、数据团队用它一键产出规范化的 Excel 报表，服务端跑无需装 Office。

## 提供的工具（Tools）
- `read_data_from_excel` — 读取单元格区域数据
- `write_data_to_excel` — 写入数据
- `create_workbook` / `create_worksheet` — 新建工作簿/表
- `apply_formula` — 写入公式
- `format_range` — 设置格式
- `create_chart` — 生成图表
- `create_pivot_table` — 生成数据透视表

## 接入方式
```bash
# stdio 本地模式，操作本地 xlsx 文件
uvx excel-mcp-server stdio
# 可用 EXCEL_FILES_PATH 指定允许操作的文件目录
```

## 调用示例
「读 sales.xlsx 里的月度明细，按区域做个数据透视表，再加一张柱状图。」

## 权限与风险
会**写/覆盖**本地 Excel 文件，属写操作。建议用 `EXCEL_FILES_PATH` 把可操作范围锁在指定目录，重要源文件先留副本，避免误覆盖。
$md$
);

-- 13. Brave 搜索 (Brave Search)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '网络搜索 (Brave Search)',
  'Brave 官方 MCP，独立索引的隐私优先搜索，覆盖网页、本地 POI、图片视频与新闻。',
  'MCP', '1.0.0', 'low', 'published',
  ARRAY['搜索','Brave','隐私','新闻','实时信息'],
  'platform', false,
  '{"repo":"brave/brave-search-mcp-server","stars":1000,"transport":"stdio","command":"npx -y @brave/brave-search-mcp-server","tools":["brave_web_search","brave_local_search","brave_image_search","brave_video_search","brave_news_search","brave_summarizer"],"env":["BRAVE_API_KEY"],"docs_url":"https://github.com/brave/brave-search-mcp-server","license":"MIT"}'::jsonb,
  $md$# 网络搜索 (Brave Search)

> Brave 官方 MCP server：基于 Brave 自有独立索引的隐私优先搜索，网页/本地/图片/视频/新闻全覆盖。

## 开源出处
- 仓库：brave/brave-search-mcp-server（约 1,000★，Brave 官方）
- 链接：https://github.com/brave/brave-search-mcp-server
- 许可：MIT

## 用途
给 AI 一个实时、可控成本、注重隐私的搜索入口：查最新资讯、找本地商户/地点、检索图片视频、拉当日新闻。因为是独立索引且提供官方 API，适合企业做合规可控的联网检索，不依赖大厂搜索引擎爬取。

## 提供的工具（Tools）
- `brave_web_search` — 网页搜索
- `brave_local_search` — 本地地点/POI 搜索
- `brave_image_search` — 图片搜索
- `brave_video_search` — 视频搜索
- `brave_news_search` — 新闻搜索
- `brave_summarizer` — AI 摘要

## 接入方式
```bash
npx -y @brave/brave-search-mcp-server
export BRAVE_API_KEY="<Brave Search API Key>"
```

## 调用示例
「搜一下最近一周关于我们竞品新品发布的中文新闻，列出标题和来源。」

## 权限与风险
**只读**搜索，无写操作。需要 `BRAVE_API_KEY`，只放服务端环境变量；注意 API 按量计费，企业内建议设配额与调用频率上限，防止被高频调用刷爆额度。
$md$
);

-- 14. Tavily 搜索 (Tavily)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  'AI 搜索 (Tavily)',
  '面向 Agent 的搜索 MCP，实时搜索、网页抽取、站点地图与爬取，为 RAG 与研究优化。',
  'MCP', '1.0.0', 'low', 'published',
  ARRAY['搜索','Tavily','RAG','研究','抽取'],
  'platform', false,
  '{"repo":"tavily-ai/tavily-mcp","stars":2300,"transport":"stdio","command":"npx -y tavily-mcp@latest","tools":["tavily-search","tavily-extract","tavily-map","tavily-crawl"],"env":["TAVILY_API_KEY"],"docs_url":"https://github.com/tavily-ai/tavily-mcp","license":"MIT"}'::jsonb,
  $md$# AI 搜索 (Tavily)

> 专为 AI Agent 打造的搜索 MCP：搜索结果直接可喂给模型，还能抽取网页正文、绘制站点地图、深度爬取。

## 开源出处
- 仓库：tavily-ai/tavily-mcp（约 2,300★）
- 链接：https://github.com/tavily-ai/tavily-mcp
- 许可：MIT

## 用途
做联网研究与 RAG 取数的利器：一次调用拿到「已清洗、带来源」的搜索结果，省去自己解析 HTML；对指定网页做正文抽取、对整站建 URL 地图、按深度爬取资料。适合竞品调研、市场分析、给知识库补充实时外部信息。

## 提供的工具（Tools）
- `tavily-search` — 实时网络搜索（返回结构化结果与来源）
- `tavily-extract` — 从网页抽取正文内容
- `tavily-map` — 生成网站结构地图
- `tavily-crawl` — 按规则爬取网站

## 接入方式
```bash
npx -y tavily-mcp@latest
export TAVILY_API_KEY="<Tavily API Key>"
```

## 调用示例
「研究一下国内 RPA 市场 2026 年的主要玩家，给我带来源的要点总结。」

## 权限与风险
以**读取/检索**为主，无写业务系统。需要 `TAVILY_API_KEY`（按量计费），只放服务端；crawl/extract 会对第三方站点发起请求，须遵守目标站条款并设并发/配额上限。
$md$
);

-- 15. Firecrawl 抓取 (Firecrawl)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '网站抓取 (Firecrawl)',
  '高星抓取 MCP，把整站网页转成干净 Markdown/JSON，支持批量爬取与结构化抽取。',
  'MCP', '1.0.0', 'low', 'published',
  ARRAY['抓取','Firecrawl','爬虫','Markdown','数据提取'],
  'platform', false,
  '{"repo":"firecrawl/firecrawl-mcp-server","stars":7000,"transport":"stdio","command":"npx -y firecrawl-mcp","tools":["firecrawl_scrape","firecrawl_map","firecrawl_search","firecrawl_crawl","firecrawl_extract"],"env":["FIRECRAWL_API_KEY"],"docs_url":"https://github.com/firecrawl/firecrawl-mcp-server","license":"MIT"}'::jsonb,
  $md$# 网站抓取 (Firecrawl)

> 高星网页抓取 MCP：把复杂网页（含 JS 渲染）转成 LLM 友好的 Markdown/JSON，单页到整站都能拿。

## 开源出处
- 仓库：firecrawl/firecrawl-mcp-server（约 7,000★）
- 链接：https://github.com/firecrawl/firecrawl-mcp-server
- 许可：MIT（以仓库 LICENSE 为准）

## 用途
需要「把网站变成结构化数据」时用它：抓取单页正文、发现全站 URL、批量爬取文档站、按 schema 用 LLM 抽取结构化字段（如商品价格、职位信息）。适合搭建外部知识库、做竞品/行业数据采集、内容迁移。

## 提供的工具（Tools）
- `firecrawl_scrape` — 抓取单个 URL 为 Markdown/JSON
- `firecrawl_map` — 发现站点全部可索引 URL
- `firecrawl_search` — 搜索并可选抓取正文
- `firecrawl_crawl` — 按深度批量爬取
- `firecrawl_extract` — 用 LLM 做结构化字段抽取

## 接入方式
```bash
# 云 API 模式
npx -y firecrawl-mcp
export FIRECRAWL_API_KEY="<Firecrawl API Key>"
# 也支持自托管：设 FIRECRAWL_API_URL 指向私有实例
```

## 调用示例
「把这个产品文档站整站抓下来转成 Markdown，用于导入我们的知识库。」

## 权限与风险
以**读取抓取**为主，无写业务系统。crawl 会对目标站发大量请求：务必设并发与页数上限、遵守 robots 与对方条款；`FIRECRAWL_API_KEY` 按量计费，只放服务端并设配额。
$md$
);

-- 16. Slack 团队消息 (Slack)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '团队消息 (Slack)',
  '高星 Slack MCP，读频道与线程消息、跨频道搜索、按需发消息，打通团队沟通。',
  'MCP', '1.0.0', 'medium', 'published',
  ARRAY['Slack','团队沟通','消息','搜索','协作'],
  'platform', false,
  '{"repo":"korotovsky/slack-mcp-server","stars":1800,"transport":"stdio","command":"npx -y slack-mcp-server@latest --transport stdio","tools":["conversations_history","conversations_replies","conversations_add_message","conversations_search_messages","channels_list","users_search"],"env":["SLACK_MCP_XOXP_TOKEN"],"docs_url":"https://github.com/korotovsky/slack-mcp-server","license":"MIT"}'::jsonb,
  $md$# 团队消息 (Slack)

> 社区高星的 Slack MCP：读消息、搜历史、发消息，把团队沟通接入 AI 助手。

## 开源出处
- 仓库：korotovsky/slack-mcp-server（约 1,800★）
- 链接：https://github.com/korotovsky/slack-mcp-server
- 许可：MIT

## 用途
让 AI 参与团队沟通：汇总某频道当日讨论、检索历史消息定位结论、把生成的报告/告警发到指定频道、按姓名查人。适合做日报播报、值班告警、跨频道信息检索。发消息能力默认关闭，需显式开启，避免误发。

## 提供的工具（Tools）
- `conversations_history` — 读频道/私信消息
- `conversations_replies` — 读线程回复
- `conversations_add_message` — 发消息（默认禁用，需开启）
- `conversations_search_messages` — 跨频道搜索
- `channels_list` — 列频道
- `users_search` — 按名/邮箱查人

## 接入方式
```bash
npx -y slack-mcp-server@latest --transport stdio
# 用户 OAuth token（推荐）
export SLACK_MCP_XOXP_TOKEN="xoxp-..."
```

## 调用示例
「把 #incident 频道过去两小时的讨论总结成一条时间线，发到 #eng-summary。」

## 权限与风险
`conversations_add_message` 属**写操作**（会真的发消息），默认禁用需谨慎开启并限定可发频道。Token 能读取工作区消息，涉及敏感沟通数据：用最小 scope 的用户/机器人令牌，只放服务端，纳入合规审计。
$md$
);

-- 17. Notion 知识库 (Notion)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '知识库 (Notion)',
  'Notion 官方 MCP，搜索/读取/创建/更新页面与数据源，把 Notion 变成 AI 可操作的知识库。',
  'MCP', '1.0.0', 'medium', 'published',
  ARRAY['Notion','知识库','文档','协作','数据源'],
  'platform', false,
  '{"repo":"makenotion/notion-mcp-server","stars":4600,"transport":"stdio","command":"npx -y @notionhq/notion-mcp-server","tools":["search","fetch_page","create_page","update_page","query_data_source","create_comment"],"env":["NOTION_TOKEN"],"docs_url":"https://github.com/makenotion/notion-mcp-server","license":"MIT"}'::jsonb,
  $md$# 知识库 (Notion)

> Notion 官方 MCP server：把 Notion 里的文档与数据库接入 AI，搜、读、写、评论一体。

## 开源出处
- 仓库：makenotion/notion-mcp-server（约 4,600★，Notion 官方）
- 链接：https://github.com/makenotion/notion-mcp-server
- 许可：MIT

## 用途
以 Notion 为团队 wiki/项目库的公司用它做知识运营：全局搜索定位资料、把页面正文读成 Markdown 供总结、根据会议结论自动建页/更新任务库、在页面留评论。让「查文档、记纪要、更新看板」在对话里完成。

## 提供的工具（Tools）
- `search` — 全局搜索页面/数据源
- `fetch_page` — 读取页面完整正文
- `create_page` — 新建页面
- `update_page` — 编辑页面内容
- `query_data_source` — 带过滤/排序查询数据源
- `create_comment` — 添加评论

## 接入方式
```bash
npx -y @notionhq/notion-mcp-server
export NOTION_TOKEN="<Notion 集成 Secret>"
```
在 Notion 里创建内部集成，并把目标页面/库共享给该集成。

## 调用示例
「把今天的产品评审结论整理成一页，建在『产品/评审记录』库下，并@负责人。」

## 权限与风险
建/改页面属**写操作**。Notion 集成的可见范围由「共享给集成的页面」决定——遵循最小授权，只共享必要空间，别把整个工作区暴露；`NOTION_TOKEN` 只放服务端。
$md$
);

-- 18. Jira / Confluence (Atlassian)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '项目与文档 (Jira / Confluence)',
  '高星 Atlassian MCP，JQL/CQL 检索、建改 Issue、读写 Confluence 页面，打通研发协作。',
  'MCP', '1.0.0', 'medium', 'published',
  ARRAY['Jira','Confluence','Atlassian','项目管理','协作'],
  'platform', false,
  '{"repo":"sooperset/mcp-atlassian","stars":5600,"transport":"stdio","command":"uvx mcp-atlassian","tools":["jira_search","jira_get_issue","jira_create_issue","jira_update_issue","jira_transition_issue","confluence_search","confluence_get_page","confluence_create_page"],"env":["JIRA_URL","JIRA_USERNAME","JIRA_API_TOKEN","CONFLUENCE_URL","CONFLUENCE_USERNAME","CONFLUENCE_API_TOKEN"],"docs_url":"https://github.com/sooperset/mcp-atlassian","license":"MIT"}'::jsonb,
  $md$# 项目与文档 (Jira / Confluence)

> 社区高星的 Atlassian MCP：同时接入 Jira（项目/缺陷）和 Confluence（文档），JQL/CQL 检索加读写。

## 开源出处
- 仓库：sooperset/mcp-atlassian（约 5,600★）
- 链接：https://github.com/sooperset/mcp-atlassian
- 许可：MIT
- 兼容 Atlassian Cloud 与 Server/Data Center。

## 用途
用 Atlassian 全家桶的团队用它把研发协作接入 AI：用 JQL 查符合条件的 Issue、根据讨论建/改 Issue 并流转状态、用 CQL 搜 Confluence、把结论写成 Confluence 页面。适合需求管理、缺陷跟踪、知识沉淀一条龙。

## 提供的工具（Tools）
- `jira_search` — JQL 查询 Issue
- `jira_get_issue` — 取 Issue 详情
- `jira_create_issue` / `jira_update_issue` — 建/改 Issue
- `jira_transition_issue` — 流转状态
- `confluence_search` — CQL 搜索页面
- `confluence_get_page` — 读页面
- `confluence_create_page` — 建页面

## 接入方式
```bash
uvx mcp-atlassian   # 或 docker run ghcr.io/sooperset/mcp-atlassian
export JIRA_URL="https://your.atlassian.net" JIRA_USERNAME="you@corp.com" JIRA_API_TOKEN="<token>"
export CONFLUENCE_URL="https://your.atlassian.net/wiki" CONFLUENCE_USERNAME="you@corp.com" CONFLUENCE_API_TOKEN="<token>"
```

## 调用示例
「查一下我名下本迭代所有未完成的 Jira 任务，并把逾期的挑出来。」

## 权限与风险
建/改/流转 Issue、写 Confluence 页面均属**写操作**。API Token 等同该账号权限：用**专用服务账号**、按项目/空间做最小授权、Token 只放服务端环境变量并定期轮换。
$md$
);

-- 19. Linear 项目管理 (Linear 官方远程)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '敏捷项目 (Linear)',
  'Linear 官方远程 MCP，管理 Issue、项目与团队，OAuth 授权，适配现代敏捷团队。',
  'MCP', '1.0.0', 'medium', 'published',
  ARRAY['Linear','项目管理','敏捷','Issue','远程MCP'],
  'platform', false,
  '{"repo":"linear (official remote)","stars":null,"transport":"http","command":"npx -y mcp-remote https://mcp.linear.app/sse","remote_url":"https://mcp.linear.app/mcp","tools":["list_issues","get_issue","create_issue","update_issue","list_projects","create_comment","list_teams"],"env":[],"auth":"OAuth","docs_url":"https://linear.app/docs/mcp","license":"proprietary (hosted)"}'::jsonb,
  $md$# 敏捷项目 (Linear)

> Linear 官方托管的远程 MCP server：把敏捷项目管理接入 AI，OAuth 一键授权、无需自建。

## 开源出处
- 提供方：Linear 官方远程 MCP（mcp.linear.app）
- 链接：https://linear.app/docs/mcp
- 说明：Linear 官方以**远程托管服务**形式提供，非开源仓库、无 GitHub 星标（社区另有若干非官方实现，质量与维护参差，不推荐）。本条为「原目标清单 Linear」的忠实保留，采用一等公民的官方远程接入。

## 用途
用 Linear 做研发管理的团队用它对话式操作：查我的/团队的 Issue、按讨论建 Issue 并指派、更新状态与优先级、看项目进展、留评论。相比自建，官方远程省去部署与令牌维护，权限由 Linear OAuth 统一管控。

## 提供的工具（Tools）
- `list_issues` — 列 Issue（支持过滤）
- `get_issue` — 取 Issue 详情
- `create_issue` — 建 Issue
- `update_issue` — 改状态/负责人/优先级
- `list_projects` — 列项目
- `create_comment` — 加评论
- `list_teams` — 列团队

## 接入方式
```bash
# 支持远程 MCP 的客户端可直接填 URL：https://mcp.linear.app/mcp
# 不支持的用 mcp-remote 桥接，首次会弹浏览器走 OAuth 授权
npx -y mcp-remote https://mcp.linear.app/sse
```

## 调用示例
「在 Linear 里给『支付重构』项目建一个 Issue：对账页加载慢，设为高优并指派给我。」

## 权限与风险
建/改 Issue 属**写操作**。走 Linear **OAuth** 授权，不落地长期密钥，权限范围与撤销由 Linear 侧统一管理；企业内建议按团队最小授权、定期审查已授权应用。
$md$
);

-- 20. Figma 设计协作 (Figma / Framelink)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '设计稿接入 (Figma)',
  '超高星 Figma MCP，把设计稿的布局与样式元数据喂给 AI，还原设计比截图更准。',
  'MCP', '1.0.0', 'low', 'published',
  ARRAY['Figma','设计协作','前端','设计还原','Framelink'],
  'platform', false,
  '{"repo":"GLips/Figma-Context-MCP","stars":15500,"transport":"stdio","command":"npx -y figma-developer-mcp --figma-api-key=YOUR_KEY --stdio","tools":["get_figma_data","download_figma_images"],"env":["FIGMA_API_KEY"],"docs_url":"https://github.com/GLips/Figma-Context-MCP","license":"MIT"}'::jsonb,
  $md$# 设计稿接入 (Figma)

> 超高星的 Framelink Figma MCP：把 Figma 设计稿的结构化布局与样式喂给 AI，让「设计转代码」更精准。

## 开源出处
- 仓库：GLips/Figma-Context-MCP（约 15,500★）
- 链接：https://github.com/GLips/Figma-Context-MCP
- 许可：MIT
- 说明：替代原目标清单中的 Google Drive（其参考实现已归档、无高星），改配为设计协作类的超高星件，服务前端与设计工作流。

## 用途
前端/设计团队用它做高保真「设计还原」：AI 直接读取 Figma 节点的尺寸、间距、颜色、字体等元数据（而非靠截图猜），据此生成更贴近设计稿的代码；也能把设计里的图片资源批量下载下来。显著减少「还原度对不上」的返工。

## 提供的工具（Tools）
- `get_figma_data` — 获取指定文件/节点的布局与样式元数据
- `download_figma_images` — 下载设计中的图片/图标资源

## 接入方式
```bash
npx -y figma-developer-mcp --figma-api-key=YOUR_KEY --stdio
# 或用环境变量
export FIGMA_API_KEY="<Figma 个人访问令牌>"
```

## 调用示例
「读这个 Figma 链接的登录页节点，按它的间距和配色生成对应的 React + Tailwind 组件。」

## 权限与风险
**只读**设计数据，不改 Figma 内容，风险低。`FIGMA_API_KEY` 能读取你有权访问的设计文件：用个人只读令牌、只放服务端；注意设计稿可能含未发布的敏感产品信息，纳入保密范围。
$md$
);

-- 21. Sentry 错误监控 (Sentry)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '错误监控 (Sentry)',
  'Sentry 官方 MCP，搜索线上错误与事件、看 Issue 详情、辅助定位与三分类。',
  'MCP', '1.0.0', 'medium', 'published',
  ARRAY['Sentry','错误监控','可观测性','排障','告警'],
  'platform', false,
  '{"repo":"getsentry/sentry-mcp","stars":800,"transport":"stdio","command":"npx -y @sentry/mcp-server@latest --access-token=YOUR_TOKEN","remote_url":"https://mcp.sentry.dev/mcp","tools":["find_projects","search_issues","search_events","get_issue_details","update_issue","analyze_issue_with_seer"],"env":["SENTRY_ACCESS_TOKEN","SENTRY_HOST"],"docs_url":"https://github.com/getsentry/sentry-mcp","license":"MIT"}'::jsonb,
  $md$# 错误监控 (Sentry)

> Sentry 官方 MCP server：把线上错误、性能事件与 Issue 三分类接入 AI，加速排障。

## 开源出处
- 仓库：getsentry/sentry-mcp（约 800★，Sentry 官方）
- 链接：https://github.com/getsentry/sentry-mcp
- 许可：MIT（以仓库为准）

## 用途
研发/SRE 用它做对话式排障：搜索某项目最近的报错、看某个 Issue 的堆栈与影响面、按条件检索事件、更新 Issue 状态（认领/解决），部分版本还能用 Seer 做 AI 根因分析。把「登 Sentry 翻错误」变成直接问 AI。

## 提供的工具（Tools）
- `find_projects` — 列组织下项目
- `search_issues` — 搜索 Issue
- `search_events` — 检索错误/性能事件
- `get_issue_details` — 看 Issue 详情与堆栈
- `update_issue` — 更新 Issue 状态
- `analyze_issue_with_seer` — Seer AI 根因分析

## 接入方式
```bash
# 本地 CLI
npx -y @sentry/mcp-server@latest --access-token=YOUR_TOKEN
# 或连官方远程： https://mcp.sentry.dev/mcp
export SENTRY_ACCESS_TOKEN="<user auth token>"   # 自托管另设 SENTRY_HOST
```

## 调用示例
「查 payment 项目今天新增的报错，按影响用户数排序，前三个各给我根因初判。」

## 权限与风险
以读为主，但含 `update_issue` 等**写操作**（改 Issue 状态）。令牌需要 project:read/write 等 scope——按最小 scope 签发、只放服务端；自托管实例用 `SENTRY_HOST` 指向内网。
$md$
);

-- 22. Grafana 可观测性 (Grafana)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '可观测性 (Grafana)',
  'Grafana 官方 MCP，检索仪表盘、查 Prometheus/Loki 指标日志、管理告警与值班。',
  'MCP', '1.0.0', 'medium', 'published',
  ARRAY['Grafana','监控','Prometheus','Loki','告警'],
  'platform', false,
  '{"repo":"grafana/mcp-grafana","stars":3300,"transport":"stdio","command":"docker run --rm -i -e GRAFANA_URL -e GRAFANA_SERVICE_ACCOUNT_TOKEN grafana/mcp-grafana -t stdio","tools":["search_dashboards","get_dashboard_by_uid","list_datasources","query_prometheus","query_loki_logs","list_alert_rules","list_incidents"],"env":["GRAFANA_URL","GRAFANA_SERVICE_ACCOUNT_TOKEN"],"docs_url":"https://github.com/grafana/mcp-grafana","license":"Apache-2.0"}'::jsonb,
  $md$# 可观测性 (Grafana)

> Grafana 官方 MCP server：把仪表盘、指标、日志、告警、值班全接入 AI，做对话式运维洞察。

## 开源出处
- 仓库：grafana/mcp-grafana（约 3,300★，Grafana 官方）
- 链接：https://github.com/grafana/mcp-grafana
- 许可：Apache-2.0
- 说明：替代原目标清单中的 Google Maps（无高星地图类 MCP），改配为同属「运维/数据观测」类的高星官方件，与 Sentry 互补。

## 用途
SRE/运维用它把监控搬进对话：找相关仪表盘、直接跑 PromQL 查指标、用 LogQL 查 Loki 日志、看当前告警规则与在处理的事件。排障时无需在多个面板间跳转，一句话拉出关键指标与日志。

## 提供的工具（Tools）
- `search_dashboards` — 搜索仪表盘
- `get_dashboard_by_uid` — 取仪表盘详情
- `list_datasources` — 列数据源
- `query_prometheus` — 跑 PromQL 查指标
- `query_loki_logs` — 跑 LogQL 查日志
- `list_alert_rules` — 列告警规则
- `list_incidents` — 列事件

## 接入方式
```bash
docker run --rm -i -e GRAFANA_URL -e GRAFANA_SERVICE_ACCOUNT_TOKEN grafana/mcp-grafana -t stdio
export GRAFANA_URL="https://grafana.corp.com"
export GRAFANA_SERVICE_ACCOUNT_TOKEN="<service account token>"
```

## 调用示例
「查一下过去 1 小时 payment 服务的 P99 延迟和错误率，有没有触发告警？」

## 权限与风险
查询类为主，但部分工具（更新仪表盘/管理告警）属**写操作**，默认危险动作需显式启用。用**服务账号令牌**并授予最小角色（多数场景 Viewer 足够），令牌只放服务端。
$md$
);

-- 23. AWS 云服务 (AWS MCP)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '云服务 (AWS)',
  'AWS 官方 MCP 合集，覆盖文档问答、成本分析、IaC/CDK、无服务器与容器等运维场景。',
  'MCP', '1.0.0', 'high', 'published',
  ARRAY['AWS','云服务','运维','成本','IaC'],
  'platform', false,
  '{"repo":"awslabs/mcp","stars":9500,"transport":"stdio","command":"uvx awslabs.core-mcp-server@latest","tools":["prompt_understanding","get_cost_and_usage","cdk_guidance","read_documentation","search_documentation"],"env":["AWS_PROFILE","AWS_REGION"],"docs_url":"https://github.com/awslabs/mcp","license":"Apache-2.0"}'::jsonb,
  $md$# 云服务 (AWS)

> AWS 官方 MCP 合集（awslabs/mcp）：一个仓库里几十个专用 server，覆盖文档、成本、IaC、无服务器、容器等。

## 开源出处
- 仓库：awslabs/mcp（约 9,500★，AWS 官方 awslabs）
- 链接：https://github.com/awslabs/mcp
- 许可：Apache-2.0

## 用途
用 AWS 的团队按需挑选子 server 接入 AI：查官方文档与最佳实践、分析账单成本与用量、生成/审查 CDK 与 IaC、辅助排查 Lambda/EKS/ECS。是「用自然语言运维 AWS」的官方入口，模块化按需组合。

## 提供的工具（示例，按所选子 server 而定）
- `prompt_understanding` — Core server：理解意图并路由到合适的 AWS 能力
- `read_documentation` / `search_documentation` — AWS 文档检索与阅读
- `get_cost_and_usage` — 成本与用量分析
- `cdk_guidance` — CDK/IaC 指导
- 另有 DynamoDB、Lambda、EKS/ECS、Serverless 等专用 server

## 接入方式
```bash
# 以 Core server 为例；其他子 server 换包名即可，如 awslabs.cost-explorer-mcp-server
uvx awslabs.core-mcp-server@latest
export AWS_PROFILE="your-profile"  AWS_REGION="ap-southeast-2"
```
凭据走标准 AWS 凭据链（`~/.aws/credentials` 的具名 profile / IAM 角色）。

## 权限与风险
部分子 server 可**触达/变更云资源**，影响面大、成本敏感，整体定为高风险。企业内务必：用**最小权限 IAM 角色/只读 policy**、优先文档与成本类只读 server、变更类操作在受控账户与人工审批下进行；绝不使用 root 或宽权限长期密钥。
$md$
);

-- 24. Cloudflare 边缘服务 (Cloudflare)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '边缘与网络 (Cloudflare)',
  'Cloudflare 官方远程 MCP 合集，覆盖文档、Workers 可观测性、Radar 网络洞察等。',
  'MCP', '1.0.0', 'high', 'published',
  ARRAY['Cloudflare','边缘计算','Workers','网络','DNS'],
  'platform', false,
  '{"repo":"cloudflare/mcp-server-cloudflare","stars":2800,"transport":"http","command":"npx -y mcp-remote https://observability.mcp.cloudflare.com/sse","remote_url":"https://docs.mcp.cloudflare.com/sse","tools":["search_cloudflare_documentation","workers_observability_query","radar_internet_insights","dns_analytics"],"env":[],"auth":"OAuth","docs_url":"https://github.com/cloudflare/mcp-server-cloudflare","license":"Apache-2.0"}'::jsonb,
  $md$# 边缘与网络 (Cloudflare)

> Cloudflare 官方远程 MCP 合集：一组托管 server，覆盖文档、Workers 可观测性、Radar 网络洞察、DNS 分析等。

## 开源出处
- 仓库：cloudflare/mcp-server-cloudflare（约 2,800★，Cloudflare 官方）
- 链接：https://github.com/cloudflare/mcp-server-cloudflare
- 许可：Apache-2.0

## 用途
用 Cloudflare 的团队用它把边缘与网络运维接入 AI：查官方文档、排查 Workers 运行日志与可观测性、用 Radar 看全网/本网络趋势、分析 DNS 流量。多为官方托管的远程 server，OAuth 授权、免自建，按能力分成多个入口按需连接。

## 提供的工具（示例，按所选远程 server 而定）
- `search_cloudflare_documentation` — 文档检索
- `workers_observability_query` — Workers 日志与可观测性
- `radar_internet_insights` — Radar 互联网趋势洞察
- `dns_analytics` — DNS 流量分析
- 另有 Workers Bindings、AI Gateway、Browser Rendering 等入口

## 接入方式
```bash
# 支持远程 MCP 的客户端直接填对应 URL；否则用 mcp-remote 桥接并走 OAuth
npx -y mcp-remote https://observability.mcp.cloudflare.com/sse
# 文档入口： https://docs.mcp.cloudflare.com/sse
```

## 权限与风险
文档/分析类为只读；但 Workers/Bindings 等入口可**变更边缘配置与资源**，影响线上，整体定为高风险。走 Cloudflare **OAuth** 授权，按账户最小权限、变更类操作限受控成员，定期审查已授权应用。
$md$
);

-- 25. Stripe 支付 (Stripe)
insert into public.skills (org_id, publisher_id, name, description, type, version, risk_level, status, tags, origin, mandatory, config, documentation)
values (
  '22f72480-222b-46ae-b0ea-00603b27581b', '71c298bb-80ef-47ee-b940-16009e929a16',
  '支付 (Stripe)',
  'Stripe 官方 MCP，管理客户、支付链接、发票、订阅与退款，并可检索官方文档。',
  'MCP', '1.0.0', 'high', 'published',
  ARRAY['Stripe','支付','订阅','发票','财务'],
  'platform', false,
  '{"repo":"stripe/agent-toolkit","stars":1700,"transport":"stdio","command":"npx -y @stripe/mcp --tools=all","remote_url":"https://mcp.stripe.com","tools":["create_customer","create_payment_link","create_invoice","list_products","create_price","create_refund","list_subscriptions","search_documentation"],"env":["STRIPE_SECRET_KEY"],"docs_url":"https://github.com/stripe/agent-toolkit","license":"MIT"}'::jsonb,
  $md$# 支付 (Stripe)

> Stripe 官方 MCP（agent-toolkit）：把支付、订阅、发票、退款与文档检索接入 AI。

## 开源出处
- 仓库：stripe/agent-toolkit（约 1,700★，Stripe 官方）
- 链接：https://github.com/stripe/agent-toolkit
- 许可：MIT
- 另提供官方远程： https://mcp.stripe.com

## 用途
做订阅/电商业务的团队用它对话式管理 Stripe：新建客户、生成支付链接、开发票、查产品与价格、创建订阅、处理退款，还能直接检索 Stripe 官方文档。适合客服辅助、财务对账、增长运营的高频操作。

## 提供的工具（Tools）
- `create_customer` — 新建客户
- `create_payment_link` — 生成支付链接
- `create_invoice` — 开发票
- `list_products` / `create_price` — 管理产品与价格
- `create_refund` — 退款
- `list_subscriptions` — 查订阅
- `search_documentation` — 检索 Stripe 文档

## 接入方式
```bash
# 本地 stdio；可用 --tools 精确控制放开哪些能力
npx -y @stripe/mcp --tools=all
export STRIPE_SECRET_KEY="<Stripe Secret Key>"
# 或连官方远程： https://mcp.stripe.com
```

## 权限与风险
涉及**真实资金**：退款、生成支付链接、改订阅都是高影响写操作，整体定为高风险。企业内必须：**先用测试密钥（sk_test_）**验证、生产密钥严格保密只放服务端、用 `--tools` 白名单只放开必要能力、退款等敏感动作加人工审批；绝不把 secret key 交给前端或写进 git。
$md$
);
