-- ============================================================================
-- seed-skills-content.sql
-- 用途：为 AIPaddle 生产 demo 组织（org_id=22f72480-222b-46ae-b0ea-00603b27581b）
--       补齐 skill 的真实、完整、可落地内容，修复「我的 Skill」中间预览区空白问题
--       （根因：所有 skill 的 documentation 正文为空）。
--
-- 范围：共 30 个 skill，全部按 id 精确 UPDATE。
--   组一：admin-demo 自建 skill 12 个（publisher=097e08c6…，「我的 Skill」页）
--   组二：平台 skill 18 个（publisher=71c298bb…，origin=platform，Skill Hub）
--
-- 只改写：name / description / type / version / risk_level / tags /
--         documentation / config / updated_at
-- 不动：  id / org_id / publisher_id / status / origin / mandatory
--
-- 执行（单事务，遇错即停）：
--   psql "$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f scripts/seed-skills-content.sql
-- 干跑（不落库）：
--   begin; \i scripts/seed-skills-content.sql; rollback;
-- documentation 使用 PostgreSQL dollar-quoted 字符串（$md$ ... $md$）避免转义。
-- ============================================================================

-- ============================================================================
-- 组一：admin-demo 自建 skill（12 个，status 保持不变）
-- ============================================================================

-- 1. 运营数据日报生成（Prompt）— 原「【种子】个人数据看板」
update public.skills set
  name = '运营数据日报生成',
  description = '按既定指标口径，将当日运营数据自动生成结构化中文日报文本，含环比/同比与异动归因。',
  type = 'Prompt',
  version = '1.2.0',
  risk_level = 'low',
  tags = ARRAY['运营','日报','数据分析','增长','自动化'],
  documentation = $md$# 运营数据日报生成

> 输入当日核心指标数值，一键产出可直接发群的运营日报文本。

## 用途
面向运营/增长团队的每日固定动作。将 DAU、GMV、转化率等零散指标，按公司统一口径组织成结论先行的日报，省去每天手工拼文案与算环比的时间，保证口径与措辞一致。

## 能力说明
- 自动计算环比（对比昨日）、同比（对比上周同一天）与达成率
- 识别异常波动（超过阈值）并生成一句话归因提示
- 按「核心结论 → 分模块指标 → 风险与关注项」的固定结构输出
- 支持自定义指标集合与阈值，缺失指标自动跳过不报错

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| metric_date | string | 是 | 报告日期，格式 YYYY-MM-DD |
| metrics | object | 是 | 指标键值对，如 {"DAU":12030,"GMV":83.2,"支付转化率":0.041} |
| compare_yesterday | object | 否 | 昨日同口径指标，用于算环比 |
| compare_last_week | object | 否 | 上周同一天指标，用于算同比 |
| highlight_threshold | number | 否 | 异动高亮阈值，默认 ±10% |

## 输出
返回一段 Markdown 日报文本，结构固定：

```
【运营日报 · 2026-07-24】
核心结论：GMV 环比 +12.3%，主要由午间大促拉动；支付转化率环比下滑 -0.4pt 需关注。
一、流量：DAU 12,030（环比 +3.1%，同比 +18%）
二、交易：GMV 83.2 万（环比 +12.3%）；订单 4,210 笔
三、风险：支付转化率 4.1%（环比 -0.4pt），建议排查支付渠道超时
```

## 调用示例
对话触发："帮我生成今天的运营日报，DAU 12030，GMV 83.2 万，支付转化 4.1%，昨天转化 4.5%。"
系统读取变量后套用口径模板产出上述文本。

## 配置要点
Prompt 类型，核心为变量注入与口径模板：
- `variables`：metric_date、metrics、compare_yesterday、compare_last_week
- 在 system prompt 中固化指标口径（如 GMV 是否含退款）与措辞风格
- 不接外部数据源，数值由调用方传入，保证可复现

## 风险与边界
- 只做文本组织与算术，不查库、不预测；数值真伪由调用方负责
- 口径变更需同步更新模板，避免同名指标含义漂移
- 归因仅为「基于波动的提示」，不代表因果结论，重大异动仍需人工核实
$md$,
  config = '{"variables":["metric_date","metrics","compare_yesterday","compare_last_week","highlight_threshold"],"output_format":"markdown","tone":"简洁·结论先行"}'::jsonb,
  updated_at = now()
where id = '9ac6603f-3276-4ac9-9ec2-150cb9df6458';

-- 2. 邮件润色助手（Prompt）— 原「【种子】实验性提示词」
update public.skills set
  name = '邮件润色助手',
  description = '对中英文商务邮件做语气润色、语法纠错与结构优化，可指定正式度与目标读者。',
  type = 'Prompt',
  version = '1.1.0',
  risk_level = 'low',
  tags = ARRAY['邮件','写作','润色','商务沟通','效率'],
  documentation = $md$# 邮件润色助手

> 把口语化草稿改写成得体、专业、无语法错误的商务邮件。

## 用途
帮助员工在对外沟通（客户、合作方、上级）时快速产出措辞得体的邮件。解决草稿语气生硬、中英夹杂、敬语缺失、逻辑松散等常见问题，统一对外沟通的专业形象。

## 能力说明
- 语气调整：可选「正式/中性/亲切」三档，适配不同对象
- 语法与拼写纠错（中英文），并标注修改点
- 结构优化：自动补齐称呼、开场、正文分点、结尾致意、签名占位
- 保留原意与关键信息，不臆造事实或承诺

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| draft | string | 是 | 邮件草稿原文 |
| formality | string | 否 | 正式度：formal/neutral/friendly，默认 neutral |
| recipient_role | string | 否 | 收件人身份，如「重要客户」「内部同事」 |
| language | string | 否 | 输出语言：zh/en，默认与草稿一致 |

## 输出
返回润色后的完整邮件文本 + 一段「主要修改说明」：

```
主题：关于本周对账差异的说明与后续安排

尊敬的李经理：
您好。就昨日提及的对账差异，我方已完成初步核查……
此致
敬礼
——
修改说明：调整开场敬语；将「你们那边搞错了」改为中性表述；补充结尾致意。
```

## 调用示例
对话触发："帮我把这封催款邮件润色得客气一点，对方是老客户：'货款到期了赶紧付'。"

## 配置要点
Prompt 类型：
- `variables`：draft、formality、recipient_role、language
- system prompt 固化敬语规范与「不新增承诺/金额/日期」的硬约束
- 不联网、不读取历史邮件，纯文本改写

## 风险与边界
- 只润色措辞，绝不新增或修改事实性内容（金额、时间、承诺）
- 涉及法律/合同措辞的邮件建议人工复核
- 不代发邮件，输出仅供复制使用
$md$,
  config = '{"variables":["draft","formality","recipient_role","language"],"options":{"formality":["formal","neutral","friendly"]},"constraints":["不新增事实性承诺"]}'::jsonb,
  updated_at = now()
where id = '0e5eb317-4e8f-4d0c-be50-a1986f929b56';

-- 3. 网页正文抓取（MCP）— 原「【种子】我的临时脚本」
update public.skills set
  name = '网页正文抓取',
  description = '通过 MCP 工具抓取指定 URL 的网页正文，去除广告/导航，转为干净 Markdown 供下游处理。',
  type = 'MCP',
  version = '1.3.0',
  risk_level = 'low',
  tags = ARRAY['爬取','网页','Markdown','信息采集','MCP'],
  documentation = $md$# 网页正文抓取

> 给一个链接，返回去噪后的正文 Markdown，供总结、问答、入库复用。

## 用途
在做资料调研、竞品监控、内容整理时，快速把网页正文提取成结构化 Markdown。自动剥离导航栏、广告、页脚、评论区等噪音，只保留标题与正文，便于 LLM 后续总结或存档。

## 能力说明
- 支持静态与部分 JS 渲染页面
- 正文抽取 + 去噪，保留标题层级、列表、表格、图片链接
- 输出 Markdown，附带页面元信息（标题、来源、抓取时间）
- 对超时/反爬/404 返回结构化错误码，不抛异常中断链路

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| url | string | 是 | 目标网页完整地址（http/https）|
| render_js | boolean | 否 | 是否等待 JS 渲染，默认 false |
| max_chars | number | 否 | 正文最大字符数，超出截断，默认 20000 |

## 输出
```json
{
  "url": "https://example.com/article",
  "title": "示例文章标题",
  "markdown": "# 示例文章标题\n\n正文段落……",
  "fetched_at": "2026-07-24T10:12:00+08:00",
  "status": "ok"
}
```

## 调用示例
工具调用：`fetch_url({ "url": "https://news.example.com/2026/ai-report" })`
对话触发："把这篇文章抓下来转成 Markdown：https://…"

## 配置要点
MCP 类型，需绑定抓取用 MCP Server：
```json
{
  "mcp_server_id": "web-fetch-mcp",
  "allowed_tools": ["fetch_url", "fetch_html"],
  "timeout_ms": 15000,
  "user_agent": "AIPaddle-Fetcher/1.0"
}
```

## 风险与边界
- 仅抓取公开可访问页面，不绕过登录墙/付费墙
- 遵守目标站点 robots 与速率限制，避免高频抓取
- 不执行页面脚本中的任意代码，仅取渲染后文本
- 抓取内容版权归原站，转载/二次分发需自行合规
$md$,
  config = '{"mcp_server_id":"web-fetch-mcp","allowed_tools":["fetch_url","fetch_html"],"timeout_ms":15000,"user_agent":"AIPaddle-Fetcher/1.0"}'::jsonb,
  updated_at = now()
where id = 'ae109554-f681-4358-9cfa-f4f0f19dedcf';

-- 4. JSON 数据格式化（Prompt）— 原「测试」
update public.skills set
  name = 'JSON 数据格式化',
  description = '校验、美化并结构化说明任意 JSON，定位语法错误、推断字段类型、生成字段说明表。',
  type = 'Prompt',
  version = '1.0.1',
  risk_level = 'low',
  tags = ARRAY['JSON','格式化','数据处理','开发工具','校验'],
  documentation = $md$# JSON 数据格式化

> 粘贴一段 JSON，返回美化排版、错误定位与字段结构说明。

## 用途
面向研发与运营的日常小工具。处理接口返回、日志片段等 JSON 时，快速做语法校验、缩进美化，并自动生成字段结构说明表，帮助理解陌生数据结构或排查格式错误。

## 能力说明
- 语法校验：定位缺逗号、括号不匹配、多余尾逗号等错误并给出行内提示
- 美化：统一缩进（2 空格）、键排序（可选）
- 结构说明：递归推断每个字段的类型、层级、是否可空
- 支持折叠超长数组，给出示例元素而非全量

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| json_text | string | 是 | 待处理的 JSON 字符串 |
| sort_keys | boolean | 否 | 是否按键名排序，默认 false |
| explain | boolean | 否 | 是否附字段说明表，默认 true |

## 输出
美化后的 JSON + 字段说明表：

```json
{
  "orderId": "A2026072400123",
  "amount": 128.5,
  "items": [ { "sku": "X-01", "qty": 2 } ]
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| orderId | string | 订单号 |
| amount | number | 金额（元）|
| items[] | array<object> | 商品明细 |

## 调用示例
对话触发："帮我校验并格式化这段 JSON，顺便说明每个字段：{...}"

## 配置要点
Prompt 类型：
- `variables`：json_text、sort_keys、explain
- system prompt 约束「只处理输入的 JSON，不联网、不执行代码」
- 对非法 JSON 返回错误位置而非直接失败

## 风险与边界
- 纯文本处理，不外发数据、不落库
- 大体积 JSON（>50KB）建议截断后处理
- 字段语义为类型推断，业务含义需结合上下文确认
$md$,
  config = '{"variables":["json_text","sort_keys","explain"],"indent":2,"max_size_kb":50}'::jsonb,
  updated_at = now()
where id = '08e71ce9-af9f-4d0c-a544-ea88845befd6';

-- 5. 内部知识库检索（API）— 原「【种子】内部知识检索」
update public.skills set
  name = '内部知识库检索',
  description = '对企业内部知识库做向量语义检索，返回相关片段与引用出处，支撑内部问答与 RAG。',
  type = 'API',
  version = '1.4.0',
  risk_level = 'medium',
  tags = ARRAY['知识库','向量检索','RAG','企业问答','语义搜索'],
  documentation = $md$# 内部知识库检索

> 用自然语言问问题，返回知识库中最相关的段落及其来源文档与页码。

## 用途
为内部 AI 助手提供可信来源。员工用自然语言提问（制度、流程、产品文档等），系统在企业向量库中做语义检索，返回带引用的片段，避免模型凭空编造，保证答案可溯源。

## 能力说明
- 向量语义检索（DashScope text-embedding-v4，1536 维）+ 关键词混合召回
- 按相似度返回 Top-K 片段，附文档标题、章节、原文链接
- 支持按部门/文档标签做权限与范围过滤
- 命中为空时明确返回「未检索到相关内容」，不硬凑

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| query | string | 是 | 用户自然语言问题 |
| top_k | number | 否 | 返回片段数，默认 5 |
| filters | object | 否 | 范围过滤，如 {"dept":"HR","tag":"制度"} |
| min_score | number | 否 | 最低相似度阈值，默认 0.72 |

## 输出
```json
{
  "hits": [
    {
      "score": 0.86,
      "text": "年假按入职满一年后每年 5 天起算……",
      "source": { "doc": "员工手册 v3", "section": "3.2 休假", "url": "https://kb/…" }
    }
  ],
  "total": 3
}
```

## 调用示例
API 调用：
```bash
POST /api/kb/search
{ "query": "试用期年假怎么算", "top_k": 5, "filters": {"dept":"HR"} }
```
对话触发："查一下公司关于试用期年假的规定。"

## 配置要点
API 类型：
- `endpoint`：内部检索服务地址
- `auth`：Bearer Token / 内部服务鉴权
- 嵌入模型：DashScope text-embedding-v4（1536 维），与入库口径一致
- 需配置向量库连接与命名空间（按 org 隔离）

## 风险与边界
- 按调用者所属部门做数据可见性过滤，不越权返回敏感文档
- 只读检索，不写入、不修改知识库
- 返回片段可能不完整，重要决策请点开原文核对
- 涉密文档需在入库时打权限标签，未打标签默认最小可见
$md$,
  config = '{"endpoint":"https://internal.aipaddle.net/api/kb/search","auth":{"type":"bearer","header":"Authorization"},"embedding_model":"text-embedding-v4","embedding_dim":1536,"top_k":5,"min_score":0.72}'::jsonb,
  updated_at = now()
where id = 'afa645da-2084-464c-950b-62192c6ff1ab';

-- 6. 报销审批预检（Workflow）— 原「【种子】审批流自动化」
update public.skills set
  name = '报销审批预检',
  description = '报销单提交前自动校验发票要素、额度与超标项，产出通过/驳回建议与整改清单。',
  type = 'Workflow',
  version = '2.0.0',
  risk_level = 'medium',
  tags = ARRAY['报销','审批','财务','合规校验','工作流'],
  documentation = $md$# 报销审批预检

> 报销单提交即自动体检：发票真伪、额度超标、要素缺失，一次性列清楚。

## 用途
在财务人工审批前拦截明显不合规的报销单，降低往返退单成本。串接发票验真、标准比对、额度校验三个节点，给出「可通过 / 需补正 / 建议驳回」的结构化预检结论。

## 能力说明
- 发票要素校验：抬头、税号、金额、发票号、日期、验真状态
- 标准比对：差旅/餐饮/交通等分类是否超公司标准
- 额度校验：单笔上限、月度累计、预算科目余额
- 重复报销检测：同一发票号是否已报销
- 输出整改清单，逐条指明问题与依据条款

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| claim_id | string | 是 | 报销单号 |
| applicant | string | 是 | 报销人工号 |
| items | array | 是 | 报销明细（类别、金额、发票号、日期）|
| cost_center | string | 否 | 成本中心/预算科目 |

## 输出
```json
{
  "verdict": "需补正",
  "issues": [
    { "item": 2, "type": "超标", "detail": "餐饮 320 元 > 标准 200 元/人", "rule": "差旅制度 4.1" },
    { "item": 3, "type": "要素缺失", "detail": "发票抬头非公司全称" }
  ],
  "pass_items": [1, 4]
}
```

## 调用示例
工作流触发：报销系统提交事件 → 调用本 skill → 结果回写审批单并 @财务。
对话触发："帮我预检一下报销单 BX20260724-08。"

## 配置要点
Workflow 类型，节点串接：
- 节点1 发票验真（调用发票识别/税局验真服务）
- 节点2 标准与额度比对（读报销标准表 + 预算余额）
- 节点3 重复报销检测（查历史报销库）
- 汇总节点产出 verdict + issues
- 需配置各节点服务地址与制度规则表版本

## 风险与边界
- 只做预检建议，最终审批权仍在财务/审批人
- 规则表需随制度更新维护版本，避免误判
- 不接触个人银行卡等支付信息
- 验真依赖外部服务，服务不可用时该项标记「待人工核验」而非直接通过
$md$,
  config = '{"nodes":["invoice_verify","standard_check","duplicate_check","aggregate"],"rule_table":"expense_policy_v3","services":{"invoice_verify":"https://internal.aipaddle.net/api/invoice/verify"},"verdict_enum":["通过","需补正","建议驳回"]}'::jsonb,
  updated_at = now()
where id = '54d5e8d4-8152-4e13-baa3-95903357556f';

-- 7. 薪酬数据脱敏统计（DB，high risk）— 原「【种子】薪资数据分析」
update public.skills set
  name = '薪酬数据脱敏统计',
  description = '对薪酬数据做只读聚合统计，字段级脱敏，仅返回分位/均值等汇总，绝不返回个人明细。',
  type = 'DB',
  version = '1.0.0',
  risk_level = 'high',
  tags = ARRAY['薪酬','脱敏','聚合统计','HR','只读'],
  documentation = $md$# 薪酬数据脱敏统计

> 只出分位数、均值、人数分布这类汇总，永远看不到某个人拿多少。

## 用途
支撑 HR/管理层做薪酬分析（分位对标、部门成本、结构分布）而不泄露个人隐私。通过只读连接对薪酬表做聚合查询，输出脱敏后的统计量，个人级明细一律不返回。

## 能力说明
- 只读聚合：均值、中位数、P25/P75/P90、标准差、人数
- 维度分组：按部门、职级、职能，但强制最小分组人数（<5 人不出数）
- 字段脱敏：姓名、工号等标识字段在查询层直接屏蔽
- 拒绝任何返回行级明细的查询请求

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| dimension | string | 是 | 分组维度：dept/level/function |
| metric | string | 是 | 统计量：mean/median/p90/count |
| filters | object | 否 | 过滤条件（如在职状态）|
| min_group_size | number | 否 | 最小分组人数，默认 5，低于则合并/隐去 |

## 输出
```json
{
  "dimension": "level",
  "rows": [
    { "group": "P6", "count": 42, "median": 28500, "p90": 41000 },
    { "group": "P7", "count": 18, "median": 39000, "p90": 55000 }
  ],
  "suppressed_groups": ["P9(人数<5，已隐去)"]
}
```

## 调用示例
对话触发："按职级看一下薪酬中位数和 P90，人数不足 5 的别显示。"
（不支持「查一下张三工资」这类个人查询，会被拒绝。）

## 配置要点
DB 类型，强约束只读：
- `connection`：只读账号（SELECT 权限，无 UPDATE/DELETE）
- `allowed_tables`：仅 comp_summary 视图（已在库侧做行级屏蔽）
- 查询模板仅暴露聚合函数，禁止 SELECT *
- 强制 GROUP BY + HAVING count >= min_group_size

## 风险与边界
- 高敏感数据。任何返回个人明细的请求一律拒绝
- 小样本分组自动隐去，防止反推个人薪酬
- 使用需具备 HR 数据分析权限，操作留审计日志
- 不导出原始表，不落地明细文件
$md$,
  config = '{"connection":{"mode":"readonly","role":"comp_ro"},"allowed_tables":["comp_summary_view"],"allowed_aggregations":["avg","percentile_cont","count","stddev"],"min_group_size":5,"deny_row_level":true}'::jsonb,
  updated_at = now()
where id = '3b70e45f-da02-4a78-8e76-b596f5dd8d5d';

-- 8. 标准合同起草（Prompt）— 原「【种子】合同模板生成」
update public.skills set
  name = '标准合同起草',
  description = '依据合同模板与业务要素，生成条款完整的合同草案，标注需人工确认的空缺项。',
  type = 'Prompt',
  version = '1.5.0',
  risk_level = 'medium',
  tags = ARRAY['合同','法务','起草','模板','商务'],
  documentation = $md$# 标准合同起草

> 填几个关键要素，产出一份条款齐全的合同初稿，风险项自动标黄。

## 用途
面向销售/商务/法务的合同起草提效工具。基于公司审定过的标准模板（采购、服务、NDA 等），结合传入的交易要素，快速生成合同草案，减少从零撰写与漏条款的风险。

## 能力说明
- 支持多类模板：采购合同、服务协议、保密协议、框架协议
- 按要素自动填充：主体、标的、金额、期限、付款、违约、争议解决
- 缺失要素以【待确认：xxx】占位并汇总在文首清单
- 保留模板中的固定风控条款，不擅自删改

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| template_type | string | 是 | 模板类型：purchase/service/nda/framework |
| party_a | string | 是 | 甲方主体全称 |
| party_b | string | 是 | 乙方主体全称 |
| terms | object | 是 | 交易要素（金额、期限、付款方式、标的等）|

## 输出
返回完整合同草案文本，文首附「待确认清单」：

```
【待确认清单】
1. 交付验收标准（terms.acceptance 未提供）
2. 违约金比例（默认 0.05%/日，请法务确认）

服务协议
甲方：XX 科技有限公司
乙方：YY 咨询有限公司
第一条 服务内容……
```

## 调用示例
对话触发："起草一份服务协议，甲方我司，乙方 YY 咨询，金额 20 万，服务期 6 个月，分两期付款。"

## 配置要点
Prompt 类型：
- `variables`：template_type、party_a、party_b、terms
- 各模板正文与固定风控条款存于 system prompt / 模板库
- 硬约束：不删除模板既有权责/违约/保密条款

## 风险与边界
- 输出为草案，非法律意见；正式签署前必须经法务审核
- 不承诺条款合法性/可执行性
- 涉及金额、期限等关键项若缺失，一律占位而非臆造
- 不联网检索外部范本，仅用公司审定模板
$md$,
  config = '{"variables":["template_type","party_a","party_b","terms"],"templates":["purchase","service","nda","framework"],"lock_clauses":["保密","违约","争议解决"],"require_legal_review":true}'::jsonb,
  updated_at = now()
where id = 'c08e87f0-437e-46b5-be50-532f2b5067a7';

-- 9. 客户360画像查询（MCP）— 原「【种子】客户信息查询」
update public.skills set
  name = '客户360画像查询',
  description = '通过 MCP 聚合 CRM、订单、工单等来源，返回单个客户的 360 度画像卡片。',
  type = 'MCP',
  version = '2.1.0',
  risk_level = 'medium',
  tags = ARRAY['CRM','客户画像','销售','360视图','MCP'],
  documentation = $md$# 客户360画像查询

> 输入客户 ID，一次拿到基础信息、成交、活跃、工单、风险的全景卡片。

## 用途
销售、客成、客服在跟进前快速了解客户全貌。通过 MCP 工具聚合分散在 CRM、订单系统、工单系统的数据，生成统一的 360 画像，避免跨系统来回查。

## 能力说明
- 聚合多源：客户基础资料、合同/成交、近期活跃、服务工单、信用/风险标签
- 计算衍生指标：LTV、近 90 天活跃度、健康分、续约概率提示
- 关键事件时间线（最近成交、最近工单、最近联系）
- 敏感字段（联系方式）按调用者角色脱敏展示

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| customer_id | string | 是 | 客户唯一标识 |
| include | array | 否 | 需聚合的模块，默认全部 |
| mask_contact | boolean | 否 | 是否脱敏联系方式，默认按角色 |

## 输出
```json
{
  "customer": { "id": "C10231", "name": "某某集团", "level": "KA", "owner": "王销售" },
  "commerce": { "total_gmv": 1280000, "contracts": 3, "renew_prob": "高" },
  "engagement": { "active_90d": true, "health_score": 82 },
  "tickets_open": 1,
  "timeline": [ { "date":"2026-07-10", "event":"续签 2 年合同" } ]
}
```

## 调用示例
工具调用：`get_customer_360({ "customer_id": "C10231" })`
对话触发："给我看看客户 C10231 的完整画像。"

## 配置要点
MCP 类型，聚合多个后端工具：
```json
{
  "mcp_server_id": "crm-aggregator-mcp",
  "allowed_tools": ["get_customer_profile", "get_orders", "get_tickets", "get_risk_tags"]
}
```
- 各子工具需配置对应系统的只读凭据
- 按 owner/角色做数据可见性控制

## 风险与边界
- 含客户隐私（联系方式、成交额），按角色脱敏并留操作日志
- 只读聚合，不修改任一源系统
- 非本人负责客户可配置为仅返回脱敏概要
- 源系统不可用时对应模块返回「暂不可用」而非中断
$md$,
  config = '{"mcp_server_id":"crm-aggregator-mcp","allowed_tools":["get_customer_profile","get_orders","get_tickets","get_risk_tags"],"mask_by_role":true}'::jsonb,
  updated_at = now()
where id = 'c3acc210-ad90-4b97-acf5-bbf354694744';

-- 10. 客服工单创建（API）— 原「【种子】工单创建」
update public.skills set
  name = '客服工单创建',
  description = '在工单系统创建客服工单，自动分类分级并分派，返回工单号与预计响应时效。',
  type = 'API',
  version = '1.6.0',
  risk_level = 'medium',
  tags = ARRAY['客服','工单','ITSM','分派','API'],
  documentation = $md$# 客服工单创建

> 描述问题，自动建单、定级、派单，回一个可跟踪的工单号。

## 用途
让 AI 助手或前台系统在识别到客户问题后，直接在工单系统创建标准工单。自动完成分类、优先级判定与责任队列分派，返回工单号与 SLA 时效，替代人工填单。

## 能力说明
- 创建工单：标题、描述、渠道、客户、附件
- 智能分类分级：按内容映射到工单类别与优先级（P1-P4）
- 自动分派：按类别路由到对应处理队列/负责人
- 幂等控制：相同来源短时间重复请求不重复建单
- 返回工单号、状态、预计首次响应时间

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| title | string | 是 | 工单标题 |
| description | string | 是 | 问题详细描述 |
| customer_id | string | 否 | 关联客户 |
| channel | string | 否 | 来源渠道：web/phone/im，默认 web |
| priority | string | 否 | 指定优先级，缺省则自动判定 |

## 输出
```json
{
  "ticket_id": "TK-20260724-0087",
  "category": "支付-退款",
  "priority": "P2",
  "assignee_queue": "交易客服组",
  "sla_first_response": "2h",
  "status": "open"
}
```

## 调用示例
API 调用：
```bash
POST /api/tickets
{ "title":"支付成功但订单未生成", "description":"用户 C10231 …", "channel":"im" }
```
对话触发："帮客户 C10231 建一个工单，支付成功但没出订单。"

## 配置要点
API 类型：
- `endpoint`：工单系统建单接口
- `auth`：API Key / OAuth2 服务账号
- `category_map`：关键词→类别→队列的路由规则
- 幂等键：来源 ID + 内容哈希

## 风险与边界
- 会真实写入工单系统（有副作用），需幂等防重
- 优先级自动判定可能偏差，P1 类可要求人工确认
- 不在工单中写入敏感支付凭证明文
- 建单失败返回明确错误码，由调用方决定重试
$md$,
  config = '{"endpoint":"https://internal.aipaddle.net/api/tickets","method":"POST","auth":{"type":"api_key","header":"X-Api-Key"},"idempotency":"source_id+content_hash","priority_enum":["P1","P2","P3","P4"]}'::jsonb,
  updated_at = now()
where id = '1fcb974f-605e-4461-b1c7-e7d2fcec7c22';

-- 11. 销售周报汇总（Prompt）— 原「【种子】销售报表汇总」
update public.skills set
  name = '销售周报汇总',
  description = '汇总多来源销售数据，生成含目标达成、漏斗、Top 机会与风险的结构化销售周报。',
  type = 'Prompt',
  version = '1.3.0',
  risk_level = 'medium',
  tags = ARRAY['销售','周报','漏斗','复盘','汇总'],
  documentation = $md$# 销售周报汇总

> 把 CRM 导出、回款、漏斗数据丢进来，产出一份能直接进周会的销售周报。

## 用途
帮销售管理者/销售运营每周汇总团队业绩。将来自 CRM、回款表、漏斗数据的多张明细，整合成结论先行、可对比的周报，突出达成率、漏斗健康度、重点机会与风险。

## 能力说明
- 目标达成：本周/本月销售额 vs 目标，环比
- 漏斗分析：各阶段商机数量、金额、转化率、平均停留天数
- Top 机会：金额最大/最可能成交的 N 个商机及卡点
- 风险预警：停滞商机、掉出预测的大单、回款逾期
- 输出可直接粘贴进周会的 Markdown

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| week | string | 是 | 周报周期，如 2026-W30 |
| pipeline | array | 是 | 商机明细（阶段、金额、负责人、更新日）|
| targets | object | 是 | 目标值（周/月）|
| collections | array | 否 | 回款明细，用于逾期分析 |

## 输出
```
【销售周报 · 2026-W30】
结论：周签约 156 万，达成周目标 104%；但 A 阶段商机转化环比 -6pt，需补前端线索。
一、达成：签约 156 万 / 目标 150 万（104%）
二、漏斗：意向 42 → 方案 18 → 商务 9 → 赢单 5
三、Top 机会：某某集团 80 万（卡在法务）……
四、风险：3 个大单停滞 >14 天；回款逾期 2 笔共 34 万
```

## 调用示例
对话触发："汇总本周（W30）销售周报，商机和回款数据我贴给你。"

## 配置要点
Prompt 类型：
- `variables`：week、pipeline、targets、collections
- 阶段定义与转化口径固化在 system prompt
- 数据由调用方传入，保证可复现，不联网

## 风险与边界
- 只做汇总与结论提炼，不预测具体成交概率数值
- 商机金额/客户为敏感商业信息，周报仅限内部
- 数据完整性由上游导出保证，缺失阶段标注而非补零
- 风险项为提示，具体处置由销售负责人判断
$md$,
  config = '{"variables":["week","pipeline","targets","collections"],"funnel_stages":["意向","方案","商务","赢单"],"output_format":"markdown"}'::jsonb,
  updated_at = now()
where id = '0a692b81-301e-4aab-93a5-0011fbcdd233';

-- 12. 飞书群消息推送（Workflow）— 原「【种子】飞书消息推送」
update public.skills set
  name = '飞书群消息推送',
  description = '向指定飞书群推送消息卡片，支持文本/卡片/@人，用于通知、告警与流程提醒。',
  type = 'Workflow',
  version = '1.4.0',
  risk_level = 'low',
  tags = ARRAY['飞书','通知','消息卡片','告警','工作流'],
  documentation = $md$# 飞书群消息推送

> 把通知内容和目标群 ID 传进来，自动发成一张飞书交互卡片。

## 用途
作为各类流程的最后一公里通知节点。审批完成、任务分派、监控告警等场景，统一通过本 skill 向飞书群推送消息卡片，支持 @相关人 与按钮跳转，替代人工手动转发。

## 能力说明
- 消息类型：纯文本、富文本、交互卡片（标题+字段+按钮）
- @能力：@全体 / @指定成员（按 open_id 或手机号映射）
- 卡片按钮：可挂跳转链接（查看详情、去处理）
- 发送结果回执：message_id、是否成功
- 失败自动重试（指数退避，最多 3 次）

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| chat_id | string | 是 | 目标飞书群 ID |
| msg_type | string | 是 | text/post/interactive |
| content | object | 是 | 消息内容（卡片结构或文本）|
| at_users | array | 否 | 需 @ 的成员 open_id 列表 |

## 输出
```json
{ "message_id": "om_xxx", "chat_id": "oc_xxx", "success": true, "sent_at": "2026-07-24T11:00:00+08:00" }
```

## 调用示例
工作流触发：报销审批通过事件 → 本节点 → 向财务群推送「BX20260724-08 已通过」卡片并 @申请人。
对话触发："往运营群 oc_xxx 发一条卡片：今日 GMV 已破百万 🎉。"

## 配置要点
Workflow 类型，封装飞书开放平台调用：
- `app_id` / `app_secret`：飞书自建应用凭证（存密钥管理，不明文）
- `token_cache`：tenant_access_token 缓存与自动刷新
- 节点：取 token → 组装卡片 → 发送 → 回执
- 群 ID 与成员 open_id 需预先授权应用可见

## 风险与边界
- 有真实外发副作用，避免在循环中高频推送导致刷屏/限流
- 不发送敏感明文（密码、密钥、完整身份证号）
- 应用需被拉入目标群且授予发消息权限，否则返回权限错误
- 凭证泄露风险高，app_secret 必须走密钥管理，禁止写入日志
$md$,
  config = '{"provider":"feishu","auth":{"app_id":"cli_xxx","app_secret":"__secret_ref__"},"nodes":["get_tenant_token","build_card","send_message","ack"],"retry":{"max":3,"backoff":"exponential"}}'::jsonb,
  updated_at = now()
where id = '67523d4e-5995-432e-9731-7dca7c0bb3aa';


-- ============================================================================
-- 组二：平台 skill（18 个，去【种子】前缀，origin/status/mandatory 保持不变）
-- ============================================================================

-- P1. PDF文本提取（Workflow）
update public.skills set
  name = 'PDF文本提取',
  description = '从 PDF 文件中提取文本与表格，保留版面结构，输出可检索的纯文本或 Markdown。',
  type = 'Workflow',
  version = '1.2.0',
  risk_level = 'low',
  tags = ARRAY['PDF','文本提取','文档处理','OCR','工作流'],
  documentation = $md$# PDF文本提取

> 上传 PDF，拿回按页组织、保留标题与表格的纯文本 / Markdown。

## 用途
将合同、报告、扫描件等 PDF 转为可检索、可入库的文本，服务于知识库入库、合同解析、报告摘要等场景。对文字型 PDF 直接抽取，对扫描件走 OCR 兜底。

## 能力说明
- 文字型 PDF：直接抽取文本，保留段落与标题层级
- 扫描/图片型 PDF：自动切换 OCR 识别
- 表格还原：尽量保留表格为 Markdown 表
- 按页输出，附页码与总页数
- 支持指定页码范围，避免整本大文件

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| file_url | string | 是 | PDF 文件地址或存储 key |
| pages | string | 否 | 页码范围，如 "1-5"，默认全部 |
| ocr_fallback | boolean | 否 | 是否对扫描页启用 OCR，默认 true |

## 输出
```json
{
  "total_pages": 12,
  "pages": [ { "page": 1, "text": "# 服务协议\n第一条 ……" } ],
  "used_ocr": false
}
```

## 调用示例
对话触发："把这份合同 PDF 提取成文本，只要前 3 页。"
工作流：文件上传事件 → PDF文本提取 → 内部知识库入库。

## 配置要点
Workflow 类型：
- 节点：类型判定（文字/扫描）→ 抽取 或 OCR → 表格还原 → 汇总
- OCR 引擎地址与语言包（中英）配置
- 大文件建议分页处理，超时阈值可调

## 风险与边界
- OCR 对低清扫描件识别率有限，关键数字建议人工复核
- 仅提取文本，不解读、不判断合同效力
- 处理的文件可能含敏感信息，遵循组织数据留存策略
- 加密/受保护 PDF 无法提取时返回明确错误
$md$,
  config = '{"nodes":["detect_type","extract_text","ocr_fallback","table_reconstruct","aggregate"],"ocr":{"engine":"paddleocr","langs":["ch","en"]},"output_format":"markdown"}'::jsonb,
  updated_at = now()
where id = '5a00c493-8290-4c98-b57a-bbc65273c342';

-- P2. 企业微信通知（DB -> Workflow）
update public.skills set
  name = '企业微信通知',
  description = '向企业微信群机器人或应用推送通知消息，支持文本/Markdown/卡片，用于告警与流程提醒。',
  type = 'Workflow',
  version = '1.1.0',
  risk_level = 'high',
  tags = ARRAY['企业微信','通知','群机器人','告警','工作流'],
  documentation = $md$# 企业微信通知

> 传入内容与目标机器人 webhook / 应用，自动发成企业微信消息。

## 用途
面向使用企业微信的组织，作为流程通知的统一出口。系统告警、审批提醒、任务分派等，通过群机器人或自建应用推送到企业微信，支持 Markdown 与图文卡片。

## 能力说明
- 群机器人：text / markdown / news 图文卡片
- 自建应用：可指定 touser / toparty / totag 定向推送
- @成员：按 userid 或手机号 @相关人
- 频率控制：内置限流，避免触发企微单机器人 20 条/分钟限制
- 发送回执与失败重试

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| target | string | 是 | 群机器人 webhook 或应用 agentid |
| msg_type | string | 是 | text/markdown/news |
| content | object | 是 | 消息内容 |
| to_users | array | 否 | 定向接收人 userid（应用模式）|

## 输出
```json
{ "errcode": 0, "errmsg": "ok", "msgid": "xxx" }
```

## 调用示例
工作流：监控告警触发 → 企业微信通知 → 推送 markdown 告警卡片到运维群。
对话触发："往运维群机器人发一条告警：数据库连接数超阈值。"

## 配置要点
Workflow 类型：
- 群机器人模式：`webhook_url`（含 key）
- 应用模式：`corp_id` / `agentid` / `secret`（走密钥管理）
- access_token 缓存刷新（应用模式）
- 限流：单机器人 ≤20 条/分钟

## 风险与边界
- 有外发副作用且涉及企业通讯录（high risk），凭证严格保密
- 不推送敏感明文（密钥、完整证件号）
- 超频会被企微限流甚至封禁机器人，务必限流
- webhook key 泄露即可被任意发消息，禁止写入日志/前端
$md$,
  config = '{"provider":"wecom","modes":["group_bot","app"],"auth":{"webhook_url":"__secret_ref__","corp_id":"","agentid":"","secret":"__secret_ref__"},"rate_limit":"20/min","retry":{"max":3}}'::jsonb,
  updated_at = now()
where id = '39445020-80e3-4481-8e3b-f415de80da67';

-- P3. 企业统一认证（MCP，mandatory 保持）
update public.skills set
  name = '企业统一认证',
  description = '对接企业 SSO/IdP，做用户身份校验与角色鉴权，为其他 skill 提供统一登录与权限上下文。',
  type = 'MCP',
  version = '2.0.0',
  risk_level = 'medium',
  tags = ARRAY['SSO','鉴权','身份认证','安全','MCP'],
  documentation = $md$# 企业统一认证

> 所有 skill 的身份底座：校验用户是谁、有什么角色、能不能调这个能力。

## 用途
作为平台强制（mandatory）的安全基座，为其余 skill 提供统一的身份与权限上下文。对接企业 IdP（OIDC/SAML），完成登录态校验、角色解析与调用鉴权，避免各 skill 各自造轮子。

## 能力说明
- 令牌校验：验证 OIDC/JWT 有效性、签发方、过期时间
- 身份解析：返回用户 id、部门、角色、权限组
- 调用鉴权：判定当前用户是否有权调用目标 skill/工具
- 会话上下文：为下游 skill 注入统一的 user context
- 支持多 IdP（企业微信/飞书/自建 LDAP）

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| token | string | 是 | 待校验的会话令牌 / JWT |
| required_scope | string | 否 | 目标操作所需权限点 |

## 输出
```json
{
  "authenticated": true,
  "user": { "id": "u1001", "name": "张三", "dept": "财务", "roles": ["finance_admin"] },
  "authorized": true,
  "expires_at": "2026-07-24T20:00:00+08:00"
}
```

## 调用示例
工具调用：`verify_identity({ "token": "eyJ…", "required_scope": "expense:approve" })`
其他 skill 在执行前先调本 skill 拿到 user context。

## 配置要点
MCP 类型：
```json
{
  "mcp_server_id": "auth-idp-mcp",
  "allowed_tools": ["verify_identity", "resolve_roles", "check_permission"],
  "idp": { "protocol": "oidc", "issuer": "https://idp.aipaddle.net" }
}
```
- 配置 IdP issuer、JWKS 地址、client 凭证
- 平台强制启用（mandatory），不可被普通用户停用

## 风险与边界
- 安全核心组件，配置错误会导致越权或全局登录失效
- 不存储明文密码，仅校验令牌
- JWKS/时钟偏移需正确配置，防止令牌误判
- 鉴权失败必须拒绝调用，绝不「放行兜底」
$md$,
  config = '{"mcp_server_id":"auth-idp-mcp","allowed_tools":["verify_identity","resolve_roles","check_permission"],"idp":{"protocol":"oidc","issuer":"https://idp.aipaddle.net","jwks_uri":"https://idp.aipaddle.net/.well-known/jwks.json"}}'::jsonb,
  updated_at = now()
where id = '981f83fe-09b2-442a-8b28-839ddfecda83';

-- P4. 会议纪要（Workflow）
update public.skills set
  name = '会议纪要',
  description = '将会议录音/转写文本整理成结构化纪要：议题、决议、待办（含负责人与截止日）。',
  type = 'Workflow',
  version = '1.3.0',
  risk_level = 'medium',
  tags = ARRAY['会议纪要','转写','待办','协作','工作流'],
  documentation = $md$# 会议纪要

> 丢进录音或转写稿，产出议题、决议、带负责人和 DDL 的待办清单。

## 用途
把会议录音或 ASR 转写文本，自动整理成规范纪要，突出「决议」和「待办」，减少会后手工整理与漏事项。适用于周会、评审会、客户会。

## 能力说明
- 语音转写（ASR）→ 说话人分离（可选）→ 纪要生成
- 结构化输出：会议信息、讨论要点、决议、待办（负责人/截止日）
- 自动识别 action item 中的负责人与时间
- 生成一句话会议摘要，便于快速回顾
- 可推送到飞书/企微或写入协作文档

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| source | string | 是 | 录音文件地址 或 转写文本 |
| meeting_title | string | 否 | 会议主题 |
| attendees | array | 否 | 参会人列表，辅助识别负责人 |

## 输出
```
【会议纪要】产品评审 · 2026-07-24
摘要：确定 V2 排期，先做检索优化，画像功能延后。
决议：
1. V2 首版聚焦检索优化
待办：
- [ ] 出检索优化方案 @李工 07-28
- [ ] 更新排期表 @PM 07-25
```

## 调用示例
对话触发："把这段会议录音整理成纪要，参会人有李工、PM、我。"
工作流：录音上传 → 会议纪要 → 待办同步到任务系统。

## 配置要点
Workflow 类型：
- 节点：ASR 转写 → （说话人分离）→ 纪要抽取 → 待办结构化
- ASR 服务地址与语言配置
- 待办抽取的负责人匹配依赖 attendees 名单

## 风险与边界
- 转写可能有识别错误，关键决议/数字建议人工确认
- 会议内容可能敏感，纪要存储遵循组织保密策略
- 负责人/截止日为模型推断，需当事人确认后才生效
- 不外发纪要，除非显式配置推送目标
$md$,
  config = '{"nodes":["asr_transcribe","speaker_diarization","summarize","extract_action_items"],"asr":{"provider":"minimax","lang":"zh"},"output_sections":["摘要","决议","待办"]}'::jsonb,
  updated_at = now()
where id = 'acee2f4c-29cf-4fac-a5a4-52785aa46baa';

-- P5. 发票识别（DB -> Workflow）
update public.skills set
  name = '发票识别',
  description = '识别增值税发票图片/PDF，抽取抬头、税号、金额、发票代码等要素并做真伪校验。',
  type = 'Workflow',
  version = '1.4.0',
  risk_level = 'low',
  tags = ARRAY['发票','OCR','财务','验真','工作流'],
  documentation = $md$# 发票识别

> 拍张发票照片，自动读出全部要素并核对真伪。

## 用途
财务报销、进项管理场景下，将发票图片/PDF 自动结构化，抽取关键要素并校验真伪，替代人工录入，为报销预检、入账提供干净数据。

## 能力说明
- 识别类型：增值税专票/普票、电子发票、火车票/机票行程单
- 要素抽取：发票代码/号码、开票日期、抬头、税号、金额、税额、销方
- 真伪校验：对接税局验真接口，返回验真状态
- 查重：结合历史库检测发票是否已使用
- 输出结构化 JSON，置信度低的字段打标提示复核

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| file_url | string | 是 | 发票图片或 PDF 地址 |
| verify | boolean | 否 | 是否调用税局验真，默认 true |

## 输出
```json
{
  "type": "增值税专用发票",
  "code": "3200...", "number": "01234567",
  "date": "2026-07-20",
  "buyer": "XX 科技有限公司", "buyer_tax_id": "91310...",
  "amount": 12800.00, "tax": 1664.00,
  "verify_status": "验真通过",
  "low_confidence_fields": []
}
```

## 调用示例
对话触发："识别这张发票并验真。"
工作流：报销上传发票 → 发票识别 → 报销审批预检。

## 配置要点
Workflow 类型：
- 节点：图像预处理 → OCR 识别 → 要素解析 → 税局验真 → 查重
- OCR 引擎与税局验真服务地址/凭据
- 验真有频率限制，需配置队列与缓存

## 风险与边界
- 模糊/遮挡发票识别率下降，低置信字段需人工核对
- 发票含企业财务信息，处理与存储须合规
- 验真依赖外部税局服务，不可用时标记「待验真」
- 只识别不入账，入账动作由财务系统负责
$md$,
  config = '{"nodes":["preprocess","ocr","parse_fields","tax_verify","dedup"],"ocr":{"engine":"invoice-ocr"},"verify_service":"https://internal.aipaddle.net/api/invoice/verify"}'::jsonb,
  updated_at = now()
where id = '55fcbf23-96d3-4ddb-8c1e-8f3543eeb73d';

-- P6. 图片OCR（Workflow）
update public.skills set
  name = '图片OCR',
  description = '通用图片文字识别，支持中英文、手写与表格，输出带坐标的文本结果。',
  type = 'Workflow',
  version = '1.2.0',
  risk_level = 'high',
  tags = ARRAY['OCR','图片识别','文字提取','表格','工作流'],
  documentation = $md$# 图片OCR

> 任意图片里的文字，识别成可复制、可定位的文本。

## 用途
通用文字识别底座，服务于证件识别、单据录入、截图取字、表格数字化等场景。相比发票识别的专用抽取，本 skill 面向任意版式图片，返回文本及其在图中的位置坐标。

## 能力说明
- 语种：中文（简繁）、英文、常见符号；支持手写体（准确率略低）
- 版式：段落、表格、竖排；返回每块文本的 bounding box
- 表格模式：还原为行列结构
- 批量：支持多图一次提交
- 置信度：逐块给出识别置信度

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| image_url | string | 是 | 图片地址或存储 key |
| mode | string | 否 | general/table/handwriting，默认 general |
| return_coords | boolean | 否 | 是否返回坐标，默认 true |

## 输出
```json
{
  "blocks": [
    { "text": "姓名：张三", "confidence": 0.98, "bbox": [12,20,180,48] }
  ],
  "full_text": "姓名：张三\n身份证号：…"
}
```

## 调用示例
对话触发："识别这张截图里的文字。"
工作流：证件上传 → 图片OCR（表格/证件模式）→ 字段结构化。

## 配置要点
Workflow 类型：
- 节点：预处理（去噪/纠偏）→ OCR → 版式解析
- 引擎与语言包配置；表格模式单独开关
- 大图/批量走异步队列

## 风险与边界
- 高风险：常用于身份证、银行卡等敏感证件，识别结果须加密存储、最小留存
- 手写与低清图识别率有限，关键信息人工复核
- 不做证件真伪鉴定，仅做文字识别
- 遵循个人信息保护要求，不得用于未授权用途
$md$,
  config = '{"nodes":["preprocess","ocr","layout_parse"],"engine":"paddleocr","langs":["ch","en"],"modes":["general","table","handwriting"],"sensitive":true}'::jsonb,
  updated_at = now()
where id = '6799ee2e-6f27-471b-8938-ff9b113b8424';

-- P7. 天气查询（MCP）
update public.skills set
  name = '天气查询',
  description = '查询指定城市的实时天气与未来预报，返回温度、天气、风力、空气质量等。',
  type = 'MCP',
  version = '1.0.0',
  risk_level = 'low',
  tags = ARRAY['天气','实时','预报','工具','MCP'],
  documentation = $md$# 天气查询

> 说个城市，返回实时天气和未来几天预报。

## 用途
通用工具类 skill，为对话助手、行程/物流/活动安排等提供天气数据支撑。支持实时天气与多日预报，可用于出行提醒、户外活动决策、配送时效评估等。

## 能力说明
- 实时天气：温度、体感、天气现象、湿度、风向风力
- 预报：未来 1-7 天逐日预报
- 空气质量：AQI、PM2.5（部分城市）
- 预警：高温/暴雨/台风等气象预警（如有）
- 支持城市名或经纬度定位

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| city | string | 是 | 城市名，如「深圳」或经纬度 |
| days | number | 否 | 预报天数，0=仅实时，默认 3 |
| include_aqi | boolean | 否 | 是否含空气质量，默认 false |

## 输出
```json
{
  "city": "深圳",
  "now": { "temp": 31, "text": "多云", "wind": "东南风 3 级", "humidity": 78 },
  "forecast": [ { "date": "2026-07-25", "high": 33, "low": 27, "text": "雷阵雨" } ]
}
```

## 调用示例
工具调用：`get_weather({ "city": "深圳", "days": 3 })`
对话触发："深圳未来三天天气怎么样？"

## 配置要点
MCP 类型：
```json
{
  "mcp_server_id": "weather-mcp",
  "allowed_tools": ["get_weather", "get_forecast"],
  "provider": "and-weather-api",
  "cache_ttl": 600
}
```
- 需配置第三方天气 API Key
- 建议缓存 10 分钟降低调用量

## 风险与边界
- 低风险，只读公开数据
- 数据来自第三方，极端天气以官方气象台为准
- 免费额度有限，需做缓存与限流
- 不做灾害应急决策依据
$md$,
  config = '{"mcp_server_id":"weather-mcp","allowed_tools":["get_weather","get_forecast"],"provider":"and-weather-api","cache_ttl":600}'::jsonb,
  updated_at = now()
where id = 'b0ac0aae-ad1a-429a-a69a-374b55e1364c';

-- P8. 客户画像（Prompt）
update public.skills set
  name = '客户画像',
  description = '基于客户结构化数据生成自然语言画像洞察：特征标签、需求判断与跟进建议。',
  type = 'Prompt',
  version = '1.2.0',
  risk_level = 'high',
  tags = ARRAY['客户画像','洞察','销售','标签','分析'],
  documentation = $md$# 客户画像

> 把客户的成交、行为数据丢进来，产出一段人能读的画像洞察和跟进建议。

## 用途
在拿到客户 360 结构化数据后，进一步生成「人话」画像洞察。将冷冰冰的指标解读为客户特征、当前阶段、潜在需求与下一步跟进建议，帮助销售/客成快速对齐策略。

## 能力说明
- 特征标签：从数据归纳客户类型（价格敏感/增长型/风险型等）
- 阶段判断：新签/成长/成熟/流失预警
- 需求推断：结合行为与工单推断潜在需求与机会点
- 跟进建议：给出 2-3 条可执行的下一步动作
- 全部结论标注「基于哪些数据」，可追溯

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| customer_data | object | 是 | 客户结构化数据（成交、活跃、工单、行业等）|
| goal | string | 否 | 分析目标：续约/增购/挽留，默认综合 |

## 输出
```
客户画像：某某集团（KA，成长型）
特征：近 90 天活跃度高，续约概率高；但近期工单集中在性能问题。
阶段：成熟期，有增购潜力。
需求推断：对稳定性敏感，可能需要更高 SLA 套餐。
跟进建议：
1. 优先解决 open 性能工单，稳住满意度
2. 铺垫高 SLA 套餐增购
```

## 调用示例
对话触发："根据客户 360 数据帮我做一份画像和跟进建议，目标是增购。"

## 配置要点
Prompt 类型：
- `variables`：customer_data、goal
- 标签体系与话术风格固化在 system prompt
- 数据由调用方传入（通常来自「客户360画像查询」），不联网

## 风险与边界
- 高风险：处理客户商业敏感数据，仅限授权销售/客成使用
- 洞察为推断，不代表客户真实意图，需在沟通中验证
- 不臆造未提供的数据，缺数据的维度明确标注「信息不足」
- 画像内容不得外传或用于未授权用途
$md$,
  config = '{"variables":["customer_data","goal"],"label_system":["价格敏感","增长型","风险型","忠诚型"],"output_max_tokens":600}'::jsonb,
  updated_at = now()
where id = '1c2f09d1-51e2-483b-a295-857267ceeb88';

-- P9. 库存查询（MCP）
update public.skills set
  name = '库存查询',
  description = '通过 MCP 查询商品在各仓库的实时库存、在途与可用量，支持按 SKU 或仓库聚合。',
  type = 'MCP',
  version = '1.1.0',
  risk_level = 'medium',
  tags = ARRAY['库存','供应链','WMS','SKU','MCP'],
  documentation = $md$# 库存查询

> 报个 SKU，返回各仓实时库存、在途和可用量。

## 用途
供应链、销售、客服在承诺交期或处理缺货时，快速查询商品实时库存。通过 MCP 对接 WMS/ERP，返回分仓库存、在途、锁定与可用量，避免超卖与交期误判。

## 能力说明
- 按 SKU 查询：现有量、锁定量、可用量、在途量
- 按仓库聚合：某仓全部/指定 SKU 库存
- 多仓合并可用量视图
- 低库存/缺货标记与安全库存对比
- 近实时（依赖 WMS 同步频率）

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| sku | string | 否 | 商品 SKU（sku 与 warehouse 至少一项）|
| warehouse | string | 否 | 仓库编码 |
| include_intransit | boolean | 否 | 是否含在途，默认 true |

## 输出
```json
{
  "sku": "X-01",
  "warehouses": [
    { "wh": "SZ01", "on_hand": 320, "locked": 40, "available": 280, "in_transit": 100 }
  ],
  "total_available": 280,
  "below_safety": false
}
```

## 调用示例
工具调用：`query_stock({ "sku": "X-01" })`
对话触发："X-01 现在各仓还有多少可用库存？"

## 配置要点
MCP 类型：
```json
{
  "mcp_server_id": "wms-mcp",
  "allowed_tools": ["query_stock", "query_warehouse"],
  "sync_freshness_sec": 120
}
```
- 配置 WMS/ERP 只读凭据
- 明确库存口径（可用量=现有-锁定）

## 风险与边界
- 中风险：库存为经营数据，限内部使用
- 近实时非绝对实时，秒杀/大促下以下单锁库结果为准
- 只读查询，不做库存调整/占用
- 口径需与业务方对齐，避免「可用量」歧义导致超卖
$md$,
  config = '{"mcp_server_id":"wms-mcp","allowed_tools":["query_stock","query_warehouse"],"sync_freshness_sec":120,"available_formula":"on_hand-locked"}'::jsonb,
  updated_at = now()
where id = 'b9500547-5a5b-46d4-8cfd-0bc0e287aba8';

-- P10. 操作审计留痕（DB，mandatory 保持）
update public.skills set
  name = '操作审计留痕',
  description = '记录关键操作的审计日志（谁、何时、对什么、做了什么、结果），只写不改，支持合规追溯。',
  type = 'DB',
  version = '2.0.0',
  risk_level = 'high',
  tags = ARRAY['审计','日志','合规','追溯','安全'],
  documentation = $md$# 操作审计留痕

> 每一次敏感操作都留一条不可篡改的记录，事后可查、可追责。

## 用途
平台强制（mandatory）的合规基座。为敏感 skill 调用、数据访问、审批动作等写入审计日志，满足内控与合规审计要求。日志只追加、不可修改删除，保证可信追溯。

## 能力说明
- 记录五要素：操作人、时间、对象、动作、结果
- append-only：仅 INSERT，无 UPDATE/DELETE 权限
- 关联上下文：请求 ID、来源 IP、调用的 skill、参数摘要（脱敏）
- 支持按人/对象/时间范围检索（只读查询接口）
- 篡改防护：可选写入哈希链，检测被改动

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| actor | string | 是 | 操作人 id |
| action | string | 是 | 动作，如 expense.approve |
| target | string | 是 | 操作对象标识 |
| result | string | 是 | success/failed/denied |
| context | object | 否 | 请求 ID、IP、参数摘要（脱敏）|

## 输出
```json
{ "log_id": "au_20260724_00931", "written": true, "hash": "a1b2..." }
```

## 调用示例
其他 skill 在完成敏感动作后自动调用：
`write_audit({ "actor":"u1001", "action":"expense.approve", "target":"BX2026...", "result":"success" })`

## 配置要点
DB 类型，写入受控：
- `connection`：仅 INSERT 权限账号
- `table`：audit_log（禁 UPDATE/DELETE）
- 参数摘要写入前脱敏（手机号/证件号掩码）
- 可选哈希链字段用于完整性校验

## 风险与边界
- 高风险合规组件，日志本身不可被业务改动
- 审计内容含敏感操作信息，检索权限严格受限（安全/审计岗）
- 参数需脱敏后入库，禁止记录明文密钥/证件
- 平台强制启用，普通用户不可停用
$md$,
  config = '{"connection":{"mode":"append_only","role":"audit_writer"},"table":"audit_log","fields":["actor","action","target","result","context"],"deny_update_delete":true,"hash_chain":true}'::jsonb,
  updated_at = now()
where id = 'acc91677-ee2c-4107-b5c3-596fec1a49c3';

-- P11. 数据合规检查（API，mandatory 保持）
update public.skills set
  name = '数据合规检查',
  description = '对文本/数据做合规扫描：识别个人敏感信息、越权字段与违规内容，给出脱敏或拦截建议。',
  type = 'API',
  version = '1.3.0',
  risk_level = 'medium',
  tags = ARRAY['数据合规','脱敏','PII','安全','拦截'],
  documentation = $md$# 数据合规检查

> 数据出库或外发前先过一遍：有没有身份证、手机号、越权字段、违规内容。

## 用途
平台强制（mandatory）的合规闸口。在数据被 skill 返回、外发或展示前做合规扫描，识别个人敏感信息（PII）与违规内容，给出脱敏/拦截建议，降低数据泄露与合规风险。

## 能力说明
- PII 识别：手机号、身份证、银行卡、邮箱、地址等
- 越权检测：是否包含调用者无权访问的字段
- 内容合规：敏感词、违规表述扫描
- 处置建议：mask（脱敏）/redact（删除）/block（拦截）
- 输出扫描报告，供上游决定放行或处理

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| payload | any | 是 | 待检查的文本或结构化数据 |
| policy | string | 否 | 合规策略集，默认 default |
| actor_scope | array | 否 | 调用者权限范围，用于越权判定 |

## 输出
```json
{
  "risk": "medium",
  "findings": [
    { "type": "PII.phone", "path": "user.phone", "suggestion": "mask" },
    { "type": "sensitive_word", "detail": "含违规表述", "suggestion": "block" }
  ],
  "verdict": "需脱敏后放行"
}
```

## 调用示例
API 调用：
```bash
POST /api/compliance/scan
{ "payload": {...}, "actor_scope": ["customer:read"] }
```
其他 skill 返回前统一过一遍。

## 配置要点
API 类型：
- `endpoint`：合规扫描服务
- `auth`：内部服务鉴权
- `policy`：可配置行业/地区合规策略集
- 强制在敏感数据出口调用（mandatory）

## 风险与边界
- 检查为辅助，误报/漏报可能存在，高敏感场景叠加人工/规则
- 本身不改数据，只给建议，处置由上游执行
- 策略需随法规更新维护
- 平台强制，普通用户不可关闭
$md$,
  config = '{"endpoint":"https://internal.aipaddle.net/api/compliance/scan","auth":{"type":"bearer"},"pii_types":["phone","id_card","bank_card","email","address"],"actions":["mask","redact","block"]}'::jsonb,
  updated_at = now()
where id = 'edc39103-9fce-4c71-9377-e18086ceb26b';

-- P12. 数据库只读查询（Prompt -> DB）
update public.skills set
  name = '数据库只读查询',
  description = '将自然语言问题转为安全的只读 SQL 并执行，仅允许 SELECT，返回结果表与所用 SQL。',
  type = 'DB',
  version = '1.5.0',
  risk_level = 'medium',
  tags = ARRAY['SQL','只读查询','数据分析','自助取数','DB'],
  documentation = $md$# 数据库只读查询

> 用大白话问数据，自动生成只读 SQL 并跑出结果，绝不改库。

## 用途
面向业务人员的自助取数。把自然语言问题转成安全的 SELECT 语句在受控只读库上执行，返回结果表并展示所用 SQL，降低取数对研发的依赖，同时用白名单和只读账号守住安全底线。

## 能力说明
- NL2SQL：自然语言 → SELECT（仅查询）
- 安全护栏：禁 INSERT/UPDATE/DELETE/DDL；强制 LIMIT
- 表/列白名单：只允许查询授权的视图与字段
- 展示生成的 SQL，便于人工核对
- 结果超行数自动截断并提示

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| question | string | 是 | 自然语言取数问题 |
| max_rows | number | 否 | 返回最大行数，默认 200 |
| schema_hint | string | 否 | 可用表/字段提示 |

## 输出
```json
{
  "sql": "SELECT dept, COUNT(*) FROM v_headcount GROUP BY dept LIMIT 200",
  "columns": ["dept", "cnt"],
  "rows": [ ["销售", 42], ["研发", 88] ],
  "truncated": false
}
```

## 调用示例
对话触发："各部门在职人数分别是多少？"
系统生成受限 SELECT 并在只读库执行。

## 配置要点
DB 类型：
- `connection`：只读账号（仅 SELECT）
- `allowed_objects`：授权视图/表白名单
- 强制注入 LIMIT，拦截非 SELECT 语句
- 展示 SQL 供审阅，禁用多语句

## 风险与边界
- 中风险：即便只读，也可能触达敏感数据，须靠白名单收敛范围
- 复杂问题生成的 SQL 可能不准，结果需结合 SQL 核对
- 绝不执行写操作，任何非 SELECT 一律拒绝
- 大结果集截断，完整导出走正式数仓流程
$md$,
  config = '{"connection":{"mode":"readonly","role":"analytics_ro"},"allowed_objects":["v_headcount","v_sales_daily"],"deny_statements":["INSERT","UPDATE","DELETE","DROP","ALTER"],"force_limit":200}'::jsonb,
  updated_at = now()
where id = 'ed204573-dd0a-466c-a621-9d3d40a51e87';

-- P13. 日历排期（API）
update public.skills set
  name = '日历排期',
  description = '查询空闲时段并创建日历事件，支持多人可用时间求交集与冲突检测。',
  type = 'API',
  version = '1.1.0',
  risk_level = 'low',
  tags = ARRAY['日历','排期','会议','协作','API'],
  documentation = $md$# 日历排期

> 找几个人的共同空档，直接把会议约上。

## 用途
帮助助手/系统在多人之间协调时间。查询相关人的日历空闲，求可用时段交集，并创建带提醒的日历事件，减少来回约时间的沟通成本。

## 能力说明
- 空闲查询：读取多人 free/busy 时段
- 交集求解：给定时长与时间窗，返回可用候选时段
- 创建事件：标题、时间、参与人、地点/会议链接、提醒
- 冲突检测：创建前检查冲突并提示
- 支持时区处理

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| action | string | 是 | find_slots / create_event |
| attendees | array | 是 | 参与人邮箱/ID |
| duration_min | number | 否 | 会议时长（分钟），find_slots 用 |
| event | object | 否 | 事件详情，create_event 用 |

## 输出
```json
{
  "slots": ["2026-07-25 14:00-14:30", "2026-07-25 16:00-16:30"]
}
```
或创建返回：
```json
{ "event_id": "evt_123", "start": "2026-07-25T14:00:00+08:00", "status": "confirmed" }
```

## 调用示例
对话触发："帮我和李工、PM 约个明天下午 30 分钟的会。"

## 配置要点
API 类型：
- `endpoint` / `provider`：飞书日历 / Google Calendar / Exchange
- `auth`：OAuth2，需用户授权访问日历
- 时区默认取组织设置

## 风险与边界
- 创建事件有副作用，会给参与人发通知，避免误建/重复建
- 读取他人日历需相应授权，未授权仅返回 busy 不返回明细
- 低风险，但涉及日程隐私，仅返回必要信息
- 冲突时提示而非强行覆盖
$md$,
  config = '{"provider":"feishu_calendar","auth":{"type":"oauth2","scopes":["calendar.read","calendar.write"]},"actions":["find_slots","create_event"],"default_tz":"Asia/Shanghai"}'::jsonb,
  updated_at = now()
where id = 'ddbbaef9-9d21-4d58-9bf8-1a4625c4f8e7';

-- P14. 汇率换算（API）
update public.skills set
  name = '汇率换算',
  description = '按实时或指定日期汇率做货币换算，支持主流币种与历史汇率查询。',
  type = 'API',
  version = '1.0.0',
  risk_level = 'medium',
  tags = ARRAY['汇率','货币换算','财务','实时行情','API'],
  documentation = $md$# 汇率换算

> 输入金额和币种，按实时或指定日期汇率算出目标币种金额。

## 用途
财务、跨境结算、报价场景下做货币换算。支持实时汇率与历史某日汇率，覆盖主流币种，便于对账、报价、成本核算时统一口径。

## 能力说明
- 实时换算：按最新汇率换算任意金额
- 历史汇率：指定日期的汇率查询与换算
- 多币种：USD/CNY/HKD/EUR/JPY 等主流币种
- 汇率来源与时间戳随结果返回，可追溯
- 支持中间价/现汇买入卖出价（依数据源）

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| amount | number | 是 | 金额 |
| from | string | 是 | 源币种，如 USD |
| to | string | 是 | 目标币种，如 CNY |
| date | string | 否 | 指定日期汇率，默认实时 |

## 输出
```json
{
  "amount": 1000, "from": "USD", "to": "CNY",
  "rate": 7.18, "result": 7180.00,
  "rate_time": "2026-07-24T09:30:00+08:00", "source": "central_parity"
}
```

## 调用示例
对话触发："1000 美元按今天汇率是多少人民币？"
API：`convert({ "amount":1000, "from":"USD", "to":"CNY" })`

## 配置要点
API 类型：
- `endpoint` / `provider`：汇率数据服务
- `auth`：API Key
- 明确汇率类型（中间价/买入/卖出）
- 缓存实时汇率，历史汇率可长缓存

## 风险与边界
- 中风险：用于财务计算，汇率口径错误会影响金额
- 数据来自第三方，正式结算以银行实际成交汇率为准
- 实时汇率有延迟，秒级行情不适用
- 历史汇率缺失日期（周末/节假日）需明确取值规则
$md$,
  config = '{"provider":"fx-rate-api","auth":{"type":"api_key"},"rate_type":"central_parity","supported":["USD","CNY","HKD","EUR","JPY","GBP"],"cache_ttl":300}'::jsonb,
  updated_at = now()
where id = '324a6c6a-e492-4bf4-a845-cb39c7a8bee3';

-- P15. 物流轨迹（API）
update public.skills set
  name = '物流轨迹',
  description = '按运单号查询物流轨迹与配送状态，自动识别快递公司，返回节点时间线与预计送达。',
  type = 'API',
  version = '1.2.0',
  risk_level = 'high',
  tags = ARRAY['物流','快递','轨迹','订单','API'],
  documentation = $md$# 物流轨迹

> 报个运单号，返回从揽收到签收的全程轨迹和预计送达。

## 用途
电商、客服、供应链场景下查询包裹物流状态。输入运单号（可自动识别快递公司），返回节点时间线、当前状态与预计送达，用于客服答疑、异常件预警、履约监控。

## 能力说明
- 自动识别快递公司（顺丰/圆通/中通/京东等）
- 轨迹时间线：揽收 → 运输 → 派送 → 签收各节点
- 当前状态与异常标记（滞留、退回、拒收）
- 预计送达时间（若数据源支持）
- 批量查询多个运单

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| tracking_no | string | 是 | 运单号 |
| carrier | string | 否 | 快递公司编码，缺省自动识别 |
| phone_tail | string | 否 | 收件人手机后 4 位（顺丰等隐私单号需要）|

## 输出
```json
{
  "tracking_no": "SF123...", "carrier": "顺丰",
  "status": "派送中",
  "trace": [
    { "time": "2026-07-23 09:12", "desc": "已揽收" },
    { "time": "2026-07-24 08:40", "desc": "派送中，派件员 138****1234" }
  ],
  "eta": "2026-07-24 18:00"
}
```

## 调用示例
对话触发："查一下运单 SF123 到哪了。"
API：`track({ "tracking_no":"SF123", "phone_tail":"1234" })`

## 配置要点
API 类型：
- `endpoint` / `provider`：物流聚合查询服务
- `auth`：API Key
- 隐私运单需传收件人手机尾号
- 缓存短时轨迹结果降低调用

## 风险与边界
- 高风险：轨迹含收件人手机、地址等个人信息，须最小化返回并脱敏展示
- 数据来自第三方，节点更新有延迟
- 隐私单号缺手机尾号会查询失败
- 仅供履约/客服用途，不得用于未授权的个人信息收集
$md$,
  config = '{"provider":"logistics-aggregator","auth":{"type":"api_key"},"auto_detect_carrier":true,"mask_recipient":true,"cache_ttl":300}'::jsonb,
  updated_at = now()
where id = '842dde06-4d42-4e56-8de5-af3424874c70';

-- P16. 翻译助手（DB -> Prompt）
update public.skills set
  name = '翻译助手',
  description = '中英及多语互译，支持术语表约束与语气风格控制，保留格式与占位符。',
  type = 'Prompt',
  version = '1.3.0',
  risk_level = 'medium',
  tags = ARRAY['翻译','多语言','术语表','本地化','写作'],
  documentation = $md$# 翻译助手

> 中英互译，术语统一、格式不乱、语气可选。

## 用途
面向文档、邮件、产品文案的翻译需求。支持中英及多语互译，可加载企业术语表保证专有名词一致，控制正式度与风格，并保留 Markdown、变量占位符等格式，适合本地化与对外沟通。

## 能力说明
- 多语互译：中↔英为主，兼顾日/韩/欧洲主要语种
- 术语表约束：指定词条按术语表固定译法
- 风格控制：正式/口语/营销语气
- 格式保留：Markdown、HTML 标签、{变量} 占位符原样保留
- 可返回「译文 + 关键术语对照」

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| text | string | 是 | 待翻译文本 |
| target_lang | string | 是 | 目标语言，如 en/zh/ja |
| glossary | object | 否 | 术语表 {源词:译词} |
| tone | string | 否 | 语气：formal/casual/marketing |

## 输出
```json
{
  "translation": "We have completed the initial reconciliation...",
  "glossary_applied": [ { "src": "对账", "dst": "reconciliation" } ]
}
```

## 调用示例
对话触发："把这段产品介绍翻成英文，营销语气，术语按我们的术语表。"

## 配置要点
Prompt 类型：
- `variables`：text、target_lang、glossary、tone
- 术语表可来自组织本地化库
- 硬约束：占位符 {xxx}、代码块、标签不翻译

## 风险与边界
- 中风险：可能翻译含商业信息的文档，仅限授权使用
- 专业/法律/医疗文本需专业人士复核
- 不新增或删减原文含义，忠实翻译
- 术语表冲突时以术语表优先，并在对照中标注
$md$,
  config = '{"variables":["text","target_lang","glossary","tone"],"preserve":["placeholders","markdown","code"],"tones":["formal","casual","marketing"]}'::jsonb,
  updated_at = now()
where id = 'c138a73b-7b84-4b20-9e00-ff44c3b3943f';

-- P17. 舆情监控（Prompt）
update public.skills set
  name = '舆情监控',
  description = '对采集到的舆情文本做情感分析、主题聚类与风险分级，生成舆情简报与预警。',
  type = 'Prompt',
  version = '1.2.0',
  risk_level = 'low',
  tags = ARRAY['舆情','情感分析','品牌','预警','简报'],
  documentation = $md$# 舆情监控

> 把抓到的评论/新闻丢进来，产出情感分布、热点主题和风险预警。

## 用途
品牌、公关、市场团队监控与自身/竞品相关的网络舆论。对采集到的评论、新闻、社媒文本做情感分析与主题聚类，识别负面高危内容，生成结构化舆情简报，支撑及时响应。

## 能力说明
- 情感分析：正面/中性/负面 + 强度
- 主题聚类：把海量文本归纳为若干热点话题
- 风险分级：负面 + 传播度 → 高/中/低风险
- 关键声音：摘出最具代表性/破坏性的原文
- 生成简报：情感分布 + Top 话题 + 风险项 + 建议

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| items | array | 是 | 舆情文本列表（含来源、时间、互动量）|
| brand | string | 否 | 关注主体，用于聚焦相关内容 |
| period | string | 否 | 统计周期标注 |

## 输出
```
【舆情简报 · 2026-07-24】
情感分布：正 52% / 中 33% / 负 15%
热点话题：1) 新版本卡顿（负面为主，↑）2) 客服响应快（正面）
风险预警：某平台一条「退款难」帖子互动 1.2 万，负面高危，建议 2h 内响应。
```

## 调用示例
对话触发："把今天抓到的这批评论做个舆情简报，重点看负面。"

## 配置要点
Prompt 类型：
- `variables`：items、brand、period
- 风险分级规则（负面强度×互动量阈值）固化在 system prompt
- 文本由上游采集（如网页正文抓取）传入，不联网

## 风险与边界
- 情感/风险为模型判断，重大危机需人工确认再行动
- 只分析所给文本，不代表全网真实舆论全貌
- 采集环节须合规，不抓取需授权/隐私数据
- 简报仅内部使用，回应口径由公关统一
$md$,
  config = '{"variables":["items","brand","period"],"sentiment_labels":["正面","中性","负面"],"risk_formula":"negativity*engagement","output_format":"markdown"}'::jsonb,
  updated_at = now()
where id = 'f9b9935f-33cc-45ae-a737-d2612521a172';

-- P18. 邮件发送（MCP）
update public.skills set
  name = '邮件发送',
  description = '通过 MCP 调用邮件服务发送邮件，支持收件人、抄送、附件与模板，返回发送结果。',
  type = 'MCP',
  version = '1.4.0',
  risk_level = 'high',
  tags = ARRAY['邮件','发送','SMTP','通知','MCP'],
  documentation = $md$# 邮件发送

> 把收件人和内容传进来，自动发出一封邮件并回执。

## 用途
作为流程/助手的邮件外发出口。支持验证码、通知、报表推送、对外沟通等场景，通过 MCP 对接企业邮件服务（SMTP/邮件 API）发送邮件，支持抄送、附件与模板变量。

## 能力说明
- 发送：to/cc/bcc、主题、正文（文本/HTML）、附件
- 模板：套用邮件模板 + 变量填充
- 回执：返回是否投递成功、message_id
- 防滥用：发送频率与收件人数量限制
- 失败重试与退信处理

## 输入参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|:--:|---|
| to | array | 是 | 收件人邮箱列表 |
| subject | string | 是 | 邮件主题 |
| body | string | 是 | 正文（文本或 HTML）|
| cc | array | 否 | 抄送 |
| attachments | array | 否 | 附件（名称 + 存储 key）|

## 输出
```json
{ "message_id": "<20260724.abc@aipaddle.net>", "accepted": ["a@x.com"], "rejected": [], "status": "sent" }
```

## 调用示例
工具调用：`send_email({ "to":["a@x.com"], "subject":"本周报表", "body":"见附件", "attachments":[...] })`
对话触发："把这份周报发给 a@x.com。"

## 配置要点
MCP 类型：
```json
{
  "mcp_server_id": "mailer-mcp",
  "allowed_tools": ["send_email"],
  "from": "noreply@aipaddle.net",
  "rate_limit": "100/hour"
}
```
- 配置 SMTP/邮件 API 凭据（走密钥管理）
- 发件域名需配置 SPF/DKIM 避免进垃圾箱

## 风险与边界
- 高风险：真实外发且可群发，需严格限流与收件人白名单/审核
- 不发送敏感明文凭证；对外邮件避免泄露内部信息
- 凭证泄露可被用于钓鱼，密钥严禁入库/入日志
- 大批量群发走专用营销通道并遵守反垃圾邮件规范
$md$,
  config = '{"mcp_server_id":"mailer-mcp","allowed_tools":["send_email"],"from":"noreply@aipaddle.net","auth":{"smtp_secret":"__secret_ref__"},"rate_limit":"100/hour"}'::jsonb,
  updated_at = now()
where id = '6a5deaaf-5fb7-444d-a641-6ff96c140b00';
