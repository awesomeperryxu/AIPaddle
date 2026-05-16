在当前项目中，请生成"Skill Hub"页面。

## 页面信息
- 页面标题：Skill Hub
- 副标题：企业 AI 能力市场
- 布局：flex h-full gap-6（左侧列表 + 右侧详情面板）

## 左侧列表区

### Header
- 左侧：标题 + 副标题
- 右侧：创建 Skill 按钮（Plus 图标 + "创建 Skill"）

### 统计卡片（grid grid-cols-4 gap-3 mb-5）
- 总数 / 已发布 / 待审核 / 总安装量

### Tab 切换
- Skill Hub（所有已发布）/ 我的 Skill

### 类型筛选（按钮组，gap-2）
- 全部 / MCP(Globe,蓝) / API(Zap,绿) / DB(Database,橙) / Workflow(GitBranch,紫) / Prompt(MessageSquare,粉)

### 搜索框
- Input pl-9 h-9，placeholder="搜索 Skill..."

### Skill 卡片列表（space-y-2）
每个 Skill 为 Card（p-4 hover:shadow-md cursor-pointer）：
- 左侧：类型图标容器（w-10 h-10 rounded-lg bg-{typeColor}/10 + 图标）
- 中间：名称(font-medium) + 类型Badge + 描述(text-sm line-clamp-1) + 发布者+安装量+评分
- 右侧上：状态标签 + 风险等级标签
- 风险等级：低(bg-green-500/10 text-green-600) / 中(bg-yellow-500/10 text-yellow-600) / 高(bg-destructive/10 text-destructive)

## 右侧详情面板（选中 Skill 后显示）
- Skill 信息头 + 完整描述 + 参数列表 + 使用文档 + 安装按钮

## Mock 数据
生成 8 个 Skill，覆盖所有类型和风险等级。
