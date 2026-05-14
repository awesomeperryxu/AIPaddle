# 【第 9 步】版本历史 / 环境变量 / Block Selector 面板

请生成以下 3 个面板组件。

---

## 面板 1：VersionHistoryPanel（版本历史面板）

320px 宽，右侧面板，白色背景，shadow-xl。

### Header
- "版本历史" 标题 + X 关闭按钮

### 过滤栏
- "全部" / "仅我的" 切换按钮
- "显示已解决" / "隐藏已解决" 过滤按钮（Filter 图标）

### 版本列表（overflow-y-auto）

每个版本项（p-3，hover:bg-gray-50，border-b）：
- 版本号徽章（如 "v12"）+ 版本描述（可编辑，点击变为 Input）
- 创建者头像 + 姓名 + 相对时间（如 "2 小时前"）
- 右侧操作菜单（三点图标，hover 显示）：
  - 恢复此版本（RotateCcw 图标）
  - 导出 DSL（Download 图标）
  - 复制版本 ID（Copy 图标）
  - 删除（Trash2 图标，红色）

### 恢复确认弹窗
- "确认恢复到此版本？当前未保存的更改将丢失。"
- 取消 + 确认恢复按钮

### 删除确认弹窗
- "确认删除此版本？此操作不可撤销。"
- 取消 + 删除按钮（红色）

### 空状态
- 居中 History 图标 + "暂无版本记录"

### 加载状态
- 骨架屏（3 个灰色占位行）

---

## 面板 2：EnvVariablePanel（环境变量面板）

360px 宽，右侧面板，白色背景，shadow-xl。

### Header
- Variable 图标 + "环境变量" 标题 + "+" 添加按钮 + X 关闭

### 说明文字
- "环境变量在工作流中全局可用，Secret 类型的值会被加密存储。"

### 变量列表

每个变量项（border，rounded-lg，p-3，mb-2）：
- 变量名（font-mono，font-medium）+ 类型徽章（string/number/secret）
- 值显示：
  - string/number → 直接显示值
  - secret → 显示 "••••••" + 眼睛图标（点击切换显示/隐藏）
- 描述文字（text-[10px]，gray-400）
- 右侧：编辑按钮（Pencil）+ 删除按钮（Trash2）

### 添加/编辑弹窗（Dialog）

字段：
- 变量名：Input（placeholder "MY_API_KEY"，仅允许大写字母、数字、下划线）
- 类型：Select（string / number / secret）
- 值：Input（secret 类型时 type=password）
- 描述：Input（可选）

底部：取消 + 保存按钮

### 删除确认
- 若变量被节点引用，显示受影响节点列表
- "以下节点引用了此变量，删除后将失效：[节点列表]"

---

## 面板 3：BlockSelector（节点添加面板）

弹出层，宽 320px，最大高度 480px，白色背景，rounded-xl，shadow-2xl。
触发方式：点击画布空白处 / 点击工具栏 "+" 按钮 / 拖拽节点端口后松开。

### 搜索栏
- 搜索 Input（Search 图标，autofocus，placeholder "搜索节点..."）

### 分类 Tab 栏（横向滚动）
- 全部 / 基础 / LLM & AI / 工具 / 知识 / 逻辑 / 数据处理 / 触发器

### 节点列表（按分类分组）

每个节点项（flex，items-center，p-2，hover:bg-gray-50，rounded-lg，cursor-pointer）：
- 节点色图标（24px 圆角方块）
- 节点名称（text-xs，font-medium）
- 节点描述（text-[10px]，gray-400，1 行截断）
- 右侧：拖拽手柄图标（GripVertical，hover 显示）

### 节点分类和内容

**基础**：开始 / 结束 / 回复（Chatflow）

**LLM & AI**：LLM / Agent / 问题分类 / 参数提取

**工具**：工具调用（列出已安装工具）/ 插件市场入口

**知识**：知识检索 / 知识库 / 文档提取

**逻辑**：条件分支 / 迭代 / 循环

**数据处理**：代码执行 / 模板转换 / 变量赋值 / 列表操作 / 人工输入

**触发器**：Webhook 触发 / 定时触发 / 插件触发

### 搜索结果
- 实时过滤，高亮匹配文字
- 无结果时显示："未找到 "xxx" 相关节点"

### 交互
- 点击节点 → 在画布中心创建该节点
- 拖拽节点 → 跟随鼠标显示幽灵节点（CandidateNode），松开在目标位置创建
