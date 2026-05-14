# 【第 3 步】全部节点卡片（30 种类型）

请生成一个 `AllNodeCards` 展示组件，包含工作流编辑器中所有节点类型的卡片 UI。

---

## 节点卡片通用结构

每个节点卡片宽度固定 240px，结构：

```
┌──────────────────────────────────────┐
│ [图标] 节点标题              [类型徽章] │  ← Header（带节点主题色背景）
├──────────────────────────────────────┤
│  节点内容区（各类型不同）              │  ← Body
├──────────────────────────────────────┤
│  ● 运行状态指示（可选）               │  ← Footer（仅运行时显示）
└──────────────────────────────────────┘
```

节点卡片基础组件：

```typescript
interface NodeCardProps {
  title: string
  type: string
  accentColor: string      // 左侧边框条颜色 + header 背景色（10% 透明度）
  icon: React.ReactNode
  status?: "not-start" | "waiting" | "running" | "succeeded" | "failed" | "retry"
  children: React.ReactNode
}
```

状态环（status ring）：节点左上角显示彩色圆环
- running：蓝色旋转动画
- succeeded：绿色实心圆
- failed：红色实心圆
- retry：橙色旋转动画

---

## 30 种节点类型

### 基础流程节点

**1. Start（开始）** — 颜色 #2970FF，Play 图标
- Body：显示输入变量列表（变量名 + 类型徽章），最多显示 3 个，超出显示 "+N 个变量"

**2. End（结束）** — 颜色 #6B7280，Square 图标
- Body：显示输出变量映射数量

**3. Answer（回复）** — 颜色 #2970FF，MessageSquare 图标，右上角"Chatflow"蓝色小徽章
- Body：回复内容预览（截断，最多 2 行）

### LLM & AI 节点

**4. LLM** — 颜色 #7C3AED，Sparkles 图标
- Body：模型名称徽章（如"GPT-4o"）+ 提示词预览（1 行截断）

**5. Agent** — 颜色 #10B981，Bot 图标
- Body：策略徽章（Function Calling / ReAct）+ 已选工具数量

**6. QuestionClassifier（问题分类）** — 颜色 #F59E0B，HelpCircle 图标
- Body：查询变量 + 分类数量徽章

**7. ParameterExtractor（参数提取）** — 颜色 #F59E0B，Sliders 图标
- Body：模型徽章 + 参数数量徽章

### 数据处理节点

**8. Code（代码执行）** — 颜色 #F59E0B，Code2 图标
- Body：语言徽章（Python3 / JavaScript）+ 代码预览（monospace，1 行）

**9. TemplateTransform（模板转换）** — 颜色 #F59E0B，FileText 图标
- Body：Jinja2 模板预览（monospace，深色背景，绿色文字）

**10. VariableAssigner（变量赋值）** — 颜色 #64748B，ArrowLeftRight 图标
- Body：赋值规则数量

**11. ListOperator（列表操作）** — 颜色 #64748B，List 图标
- Body：操作类型徽章（过滤/排序/切片/去重）

**12. DocumentExtractor（文档提取）** — 颜色 #64748B，FileSearch 图标
- Body：文件变量引用 + 解析模式徽章

### 知识与数据节点

**13. KnowledgeRetrieval（知识检索）** — 颜色 #06B6D4，BookOpen 图标
- Body：已选知识库数量 + 检索模式徽章

**14. KnowledgeBase（知识库）** — 颜色 #06B6D4，Database 图标
- Body：知识库名称

**15. DataSource（数据源）** — 颜色 #06B6D4，Table2 图标
- Body：数据源名称 + 查询类型

### 逻辑控制节点

**16. IfElse（条件分支）** — 颜色 #F59E0B，GitBranch 图标
- Body：IF 条件预览（1 行）+ ELIF 数量徽章

**17. Iteration（迭代）** — 颜色 #3B82F6，RefreshCw 图标，蓝色虚线边框容器
- Body：输入数组变量 + 并行模式徽章（若开启）
- 容器样式：蓝色虚线边框，内部有子节点占位区

**18. Loop（循环）** — 颜色 #8B5CF6，Repeat 图标，紫色虚线边框容器
- Body：循环变量数量 + 最大次数
- 容器样式：紫色虚线边框

### 集成节点

**19. HttpRequest（HTTP 请求）** — 颜色 #EF4444，Globe 图标
- Body：方法徽章（GET/POST 等，不同颜色）+ URL 预览（截断）

**20. Tool（工具调用）** — 颜色 #64748B，Wrench 图标
- Body：工具名称 + 参数数量

**21. HumanInput（人工输入）** — 颜色 #2970FF，UserCheck 图标
- Body：提示文字预览 + 超时时间徽章

### 触发器节点

**22. TriggerWebhook（Webhook 触发）** — 颜色 #F97316，Webhook 图标
- Body：Webhook URL（截断，monospace）

**23. TriggerSchedule（定时触发）** — 颜色 #F97316，Clock 图标
- Body：Cron 表达式（monospace）+ 下次执行时间

**24. TriggerPlugin（插件触发）** — 颜色 #F97316，Puzzle 图标
- Body：插件名称 + 版本

### 特殊节点

**25. NoteNode（备注）** — 无连接端口，便利贴样式
- 8 种主题色（黄/蓝/绿/紫/粉/橙/灰/白）
- 可调整大小（右下角拖拽手柄）
- 富文本内容预览
- 可选显示作者署名

**26. IterationStart（迭代开始标记）** — 蓝色，内部容器标记节点
**27. LoopStart（循环开始标记）** — 紫色，内部容器标记节点
**28. LoopEnd（循环结束标记）** — 紫色，内部容器标记节点

---

## 展示要求

生成一个 `NodeCardGallery` 组件，用网格布局展示所有节点类型，每行 3 个，带分类标题。同时导出每个节点的独立组件供单独使用。

节点卡片右键菜单（NodeActionsMenu）：
- 复制节点
- 粘贴节点
- 删除节点
- 禁用/启用节点
- 查看运行日志（仅运行后显示）
