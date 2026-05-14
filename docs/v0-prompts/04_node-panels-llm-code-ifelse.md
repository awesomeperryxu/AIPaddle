# 【第 4 步】节点配置面板：LLM / Code / IfElse

请生成以下 3 个节点配置面板组件。所有面板为 380px 宽右侧抽屉，白色背景，左侧边框，shadow-xl。

---

## 面板通用结构

```
┌─────────────────────────────────────────┐
│ [节点色图标] 节点名称    [类型徽章] [×]  │  ← Header（节点主题色浅背景）
├─────────────────────────────────────────┤
│  参数配置 │ 输入变量 │ 输出变量          │  ← Tab 栏（下划线激活）
├─────────────────────────────────────────┤
│                                         │
│  Tab 内容区（overflow-y-auto）           │
│                                         │
├─────────────────────────────────────────┤
│  [重置（outline）]  [保存（primary）]    │  ← Footer
└─────────────────────────────────────────┘
```

---

## 面板 1：LLM 节点配置面板

Header：紫色（#7C3AED）背景，Sparkles 图标，"LLM" 标题，"LLM" 徽章

**参数配置 Tab：**

1. 模型选择
   - 下拉选择器，选项：GPT-4o / Claude Sonnet 4.6 / Gemini 1.5 Pro / Qwen-Max
   - 选中后显示模型提供商小图标

2. 系统提示词
   - 标签 + Textarea（min-h-[120px]）
   - 支持 `{{变量名}}` 变量插入，变量显示为彩色 chip

3. 用户提示词
   - 同上，Textarea（min-h-[80px]）

4. 参数设置（可折叠，ChevronDown 展开）
   - Temperature：Slider（0-2，步长 0.1）+ 数字输入框
   - Max Tokens：Slider（100-8000）+ 数字输入框
   - Top P：Slider（0-1，步长 0.01）+ 数字输入框

5. 记忆（Memory）— 仅 Chatflow 显示
   - Switch 开关 + 历史消息数量 Input（开启后显示）

6. 视觉（Vision）
   - Switch 开关（支持图片输入）

7. 高级设置（可折叠）
   - 嵌入 RetryConfig 组件（重试次数 Slider 1-10 + 间隔 Slider 100-5000ms）
   - 嵌入 ErrorHandleConfig 组件（无处理/失败分支/默认值 单选）

**输入变量 Tab：**
- 列表显示已引用的变量（变量名 + 来源节点 + 类型徽章）

**输出变量 Tab：**
- `text`（string）— LLM 输出文本
- `usage`（object）— Token 使用量
- `finish_reason`（string）— 结束原因

---

## 面板 2：Code 节点配置面板

Header：琥珀色（#F59E0B）背景，Code2 图标，"代码执行" 标题，"Code" 徽章

**参数配置 Tab：**

1. 编程语言切换
   - "Python 3" / "JavaScript" 分段控件（全宽，激活 = primary 背景）

2. 输入变量列表
   - 每行：[变量名 Input（w-24）] [变量引用 Select（flex-1）] [删除按钮]
   - "添加" 按钮（Plus 图标）

3. 代码编辑器
   - Textarea，`font-mono bg-gray-900 text-green-400 border-gray-700 min-h-[200px]`
   - 顶部工具栏：语言标签 + "同步函数签名" 按钮
   - 注释：真实实现使用 `@monaco-editor/react`

**输出变量 Tab：**
- 说明文字："输出变量由代码 return 字典自动推断"
- 示例：`output`（string）灰色行

---

## 面板 3：IfElse 节点配置面板

Header：蓝色（#3B82F6）背景，GitBranch 图标，"条件分支" 标题，"IF/ELSE" 徽章

**参数配置 Tab（无其他 Tab）：**

条件组列表（可动态增减）：

**IF 组**（必须，不可删除）：
- 组头：GripVertical 拖拽手柄 + "IF" 蓝色徽章 + AND/OR 切换按钮
- 条件行列表：[变量 Select（w-28）] [运算符 Select（w-20）] [值 Input（flex-1）] [删除]
  - 运算符选项：包含 / 不包含 / 等于 / 不等于 / 大于 / 小于 / 大于等于 / 小于等于 / 为空 / 不为空 / 以...开头 / 以...结尾
- "添加条件" 幽灵按钮

**ELIF 组**（可选，可多个，可删除，可拖拽排序）：
- 同 IF 组结构，但徽章为琥珀色 "ELIF" + 右上角删除按钮

**ELSE 块**（固定，不可删除）：
- 虚线边框，灰色 "ELSE" 徽章，"其他情况走此分支" 提示文字

底部："添加 ELIF 分支" outline 按钮（全宽）

Footer：重置 + 保存
