在当前项目中，请生成以下辅助页面。每个页面在侧边栏对应导航项点击时显示。

---

## 页面 A：个人助理

**路径**：点击"个人助理"导航项  
**布局**：flex h-full

### 左侧会话列表（w-72, border-r, flex flex-col）
- 顶部：Button "新建会话"（Plus 图标，w-full）
- 会话列表（flex-1 overflow-y-auto）：每项（px-3 py-2.5 rounded-md cursor-pointer hover:bg-muted）
  - 会话标题（text-sm font-medium truncate）
  - 最后消息时间（text-xs text-muted-foreground）
  - 选中态：bg-muted

### 右侧对话区（flex-1 flex flex-col）
- 空状态（居中）：大图标 + "选择或创建一个会话开始对话" + 4 个预设问题按钮（Button variant="outline"）
- 对话状态：
  - 消息列表（flex-1 overflow-y-auto p-4 space-y-4）
  - 用户消息：ml-auto max-w-[70%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2
  - AI 消息：mr-auto max-w-[70%] bg-muted rounded-2xl rounded-bl-sm px-4 py-2
  - 底部输入区（border-t p-4）：Textarea + 发送按钮(Send 图标)

---

## 页面 B：安全管理

**路径**：点击"安全管理"导航项  
**布局**：垂直堆叠 space-y-6

- Header：标题"安全管理" + 副标题"审核和管理 AI 资产发布"
- 统计卡片（grid grid-cols-4 gap-3）：待审核(3,黄) / 本月已审核(12) / 已批准(9,绿) / 已拒绝(3,红)
- Tab 筛选：全部 / Agent 发布 / Skill 发布 / 权限变更
- 审核列表 Table：
  - 列：资源名称(带类型图标) / 审核类型(Badge) / 提交人(Avatar+名称) / 提交时间 / 风险等级(低=绿/中=黄/高=红 Badge) / 状态(待审核=黄/已批准=绿/已拒绝=红) / 操作
  - 操作：查看详情按钮 → Dialog（资源信息 + 风险评估 + 批准/拒绝按钮）

Mock 数据：5 条审核记录

---

## 页面 C：成员管理

**路径**：点击"成员管理"导航项  
**布局**：垂直堆叠 space-y-6

- Header：标题"成员管理" + 邀请成员按钮(UserPlus 图标)
- 筛选栏：角色 Select（全部/Admin/Developer/User）+ 状态 Select（全部/活跃/已禁用）+ 搜索框
- 成员 Table：
  - 列：用户(Avatar+姓名+邮箱双行) / 部门 / 角色(Badge: Admin=蓝/Developer=紫/User=绿) / 状态(绿点"活跃"/灰点"已禁用") / 最后活跃 / 操作
  - 操作 DropdownMenu：编辑角色 / 启用或禁用 / 删除(text-destructive)
- 邀请成员 Dialog：邮箱 Input + 角色 Select + 部门 Select + 发送邀请按钮

Mock 数据：8 个成员

---

## 页面 D：知识库管理

**路径**：点击"知识库管理"导航项  
**布局**：垂直堆叠 space-y-6

- Header：标题"知识库管理" + 创建知识库按钮
- 知识库卡片网格（grid grid-cols-3 gap-4）：
  - 每张 Card（p-4 hover:shadow-md cursor-pointer）：
    - 图标容器（w-10 h-10 rounded-lg bg-purple-500/10 + Database 图标 text-purple-500）
    - 名称（font-medium）
    - 描述（text-sm text-muted-foreground line-clamp-2）
    - 指标行（text-xs text-muted-foreground gap-3）：文档数 | 存储大小 | 关联 Agent 数
    - 状态指示：向量化完成(绿色圆点) / 索引中(黄色动画) / 错误(红色)

Mock 数据：4 个知识库

---

## 开发中页面（Key 管理/账单管理/系统设置）

当点击这些导航项时，显示统一的"开发中"占位页面：
- 居中布局
- w-14 h-14 rounded-xl bg-muted 图标容器 + Settings 图标
- 标题"功能开发中"（text-lg font-semibold）
- 副标题"此模块正在开发中，敬请期待"（text-sm text-muted-foreground）
