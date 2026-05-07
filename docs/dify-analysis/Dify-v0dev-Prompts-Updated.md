# Dify 平台前端实现 - v0.dev 提示词（基于真实系统）

**版本**: 2.0 (更新版)  
**基于**: Computer Use 真实登录后系统截图  
**分析日期**: 2026-04-29

---

## 🎯 重要说明

本提示词基于真实 Dify Cloud 系统的截图和分析，包含实际的：
- UI 组件和样式
- 路由结构
- 交互模式
- CSS 类名
- Data attributes

---

## 技术栈要求

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS（使用 CSS 变量）
- **UI 组件**: 自定义组件库
- **图标**: Remix Icon
- **国际化**: 支持繁体中文

---

## 设计系统（从真实系统提取）

### 颜色变量

```css
/* 输入框 */
--components-input-bg-normal
--components-input-bg-hover
--components-input-bg-active
--components-input-border-hover
--components-input-border-active
--components-input-text-filled
--components-input-text-placeholder

/* 卡片 */
--components-card-bg
--components-card-border

/* 主色 */
--primary-600
```

### 圆角系统

```css
.radius-md {
  border-radius: 8px;
}

.rounded-xl {
  border-radius: 12px;
}
```

### 字体系统

```css
.system-sm-regular {
  /* 小号常规字体 */
}
```

---

## 核心页面实现

### 1. 主布局 (Main Layout)

**v0.dev 提示词**:

```
创建一个 Dify 风格的主布局组件，包含：

顶部导航栏（固定）:
- 左侧: Dify Logo
- 中间: 5个导航项（探索、工作室、知識庫、工具、外掛）
- 右侧: 搜索图标、用户头像

导航项样式:
- 默认: 灰色文字
- Hover: 背景变浅
- Active: 蓝色文字 + 底部蓝色下划线

用户头像:
- 圆形
- 显示工作空间名称首字母
- 点击显示下拉菜单

使用 Tailwind CSS 和 TypeScript。
```

**代码示例**:

```tsx
// components/layout/MainLayout.tsx
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50">
        <div className="flex items-center justify-between h-full px-6">
          {/* Logo */}
          <div className="flex items-center space-x-8">
            <a href="/apps" className="text-xl font-bold text-gray-900">
              Dify
            </a>
            
            {/* 导航 */}
            <nav className="flex space-x-1">
              <NavItem href="/explore/apps" label="探索" />
              <NavItem href="/apps" label="工作室" active />
              <NavItem href="/datasets" label="知識庫" />
              <NavItem href="/tools" label="工具" />
              <NavItem href="/plugins" label="外掛" />
            </nav>
          </div>
          
          {/* 右侧 */}
          <div className="flex items-center space-x-4">
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <i className="i-ri-search-line w-5 h-5" />
            </button>
            <WorkspaceAvatar name="PPERRY's Workspace" />
          </div>
        </div>
      </header>
      
      {/* 主内容 */}
      <main className="pt-16">
        {children}
      </main>
    </div>
  );
}

function NavItem({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <a
      href={href}
      className={`
        px-4 py-2 rounded-lg text-sm font-medium transition-colors
        ${active 
          ? 'text-blue-600 bg-blue-50' 
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }
      `}
    >
      {label}
      {active && <div className="h-0.5 bg-blue-600 mt-1" />}
    </a>
  );
}
```

---

### 2. 工作室页面 (Studio) - `/apps`

**v0.dev 提示词**:

```
创建 Dify 工作室页面，包含：

顶部区域:
- 标题: "工作室"
- 搜索框（左侧有搜索图标，占位符: "搜尋應用..."）
- 标签筛选下拉菜单（"全部標籤"）

Tab 切换器:
- 全部
- 工作流
- 高级聊天
- 聊天
- Agent 聊天
- 完成

创建应用按钮（右上角）:
点击后显示3个选项:
1. 建立空白應用
2. 從應用模版建立
3. 匯入 DSL 檔案

应用网格:
- 3列布局
- 每个卡片高度 160px
- 圆角 12px
- 边框 0.5px
- Hover 时阴影增强

空状态:
- 显示提示文字
- "參與社群" 链接

使用 Tailwind CSS，CSS 变量用于颜色。
```

**代码示例**:

```tsx
// app/apps/page.tsx
export default function StudioPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* 顶部 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">工作室</h1>
        
        <div className="flex items-center space-x-4">
          {/* 搜索框 */}
          <div className="relative">
            <i className="i-ri-search-line absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜尋應用..."
              className="
                w-64 pl-10 pr-3 py-2
                border border-transparent
                bg-[var(--components-input-bg-normal)]
                text-[var(--components-input-text-filled)]
                placeholder:text-[var(--components-input-text-placeholder)]
                rounded-lg
                hover:border-[var(--components-input-border-hover)]
                hover:bg-[var(--components-input-bg-hover)]
                focus:border-[var(--components-input-border-active)]
                focus:bg-[var(--components-input-bg-active)]
                focus:shadow-xs
                outline-none
                transition-colors
              "
            />
          </div>
          
          {/* 标签筛选 */}
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            全部標籤
            <i className="i-ri-arrow-down-s-line ml-2" />
          </button>
          
          {/* 创建按钮 */}
          <CreateAppButton />
        </div>
      </div>
      
      {/* Tab 切换 */}
      <div className="flex space-x-2 mb-6 border-b border-gray-200">
        <Tab label="全部" active data-testid="tab-item-all" />
        <Tab label="工作流" data-testid="tab-item-workflow" />
        <Tab label="高级聊天" data-testid="tab-item-advanced-chat" />
        <Tab label="聊天" data-testid="tab-item-chat" />
        <Tab label="Agent 聊天" data-testid="tab-item-agent-chat" />
        <Tab label="完成" data-testid="tab-item-completion" />
      </div>
      
      {/* 应用网格 */}
      <div className="grid grid-cols-3 gap-4">
        <AppCard
          name="示例应用"
          type="workflow"
          icon="🤖"
        />
        {/* 更多应用卡片 */}
      </div>
      
      {/* 空状态 */}
      <EmptyState />
    </div>
  );
}

function AppCard({ name, type, icon }: { name: string; type: string; icon: string }) {
  return (
    <div className="
      relative col-span-1 inline-flex h-[160px] flex-col justify-between
      rounded-xl border-[0.5px]
      border-[var(--components-card-border)]
      bg-[var(--components-card-bg)]
      p-4
      transition-shadow hover:shadow-lg
      cursor-pointer
    ">
      <div>
        <div className="text-3xl mb-2">{icon}</div>
        <h3 className="font-medium text-gray-900">{name}</h3>
      </div>
      
      <div className="flex items-center justify-between">
        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
          {type}
        </span>
        <button className="p-1 hover:bg-gray-100 rounded">
          <i className="i-ri-more-line" />
        </button>
      </div>
    </div>
  );
}

function CreateAppButton() {
  return (
    <div className="relative">
      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        建立應用
      </button>
      
      {/* 下拉菜单 */}
      <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
        <button className="w-full px-4 py-2 text-left hover:bg-gray-50">
          建立空白應用
        </button>
        <button className="w-full px-4 py-2 text-left hover:bg-gray-50">
          從應用模版建立
        </button>
        <button className="w-full px-4 py-2 text-left hover:bg-gray-50">
          匯入 DSL 檔案
        </button>
      </div>
    </div>
  );
}
```

---

### 3. 知識庫页面 (Knowledge Base) - `/datasets`

**v0.dev 提示词**:

```
创建 Dify 知識庫页面，包含：

顶部:
- 标题: "知識庫"
- 搜索框
- 标签筛选
- 创建按钮（显示3个选项）

创建知识库的3种方式:
1. 建立知識庫 (/datasets/create)
2. 從知識管線建立 (/datasets/create-from-pipeline)
3. 連接到外部知識庫 (/datasets/connect)

知识库卡片:
- 显示名称、状态、文档数量
- 状态指示器（绿色圆点 = 活跃）
- 操作按钮

提示框:
- "你知道嗎？" 标题
- 帮助文字
- 链接到文档

外部知識 API 标签

使用 Tailwind CSS 和 TypeScript。
```

**代码示例**:

```tsx
// app/datasets/page.tsx
export default function KnowledgeBasePage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* 顶部 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">知識庫</h1>
        
        <div className="flex items-center space-x-4">
          <SearchInput placeholder="搜尋知識庫..." />
          <TagFilter />
          <CreateKnowledgeButton />
        </div>
      </div>
      
      {/* 提示框 */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">你知道嗎？</h3>
        <p className="text-sm text-blue-700">
          您可以從知識管線建立知識庫，或連接到外部知識庫 API。
          <a href="https://docs.dify.ai" className="underline ml-1">瞭解更多</a>
        </p>
      </div>
      
      {/* 外部知識 API 标签 */}
      <div className="flex space-x-2 mb-6">
        <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
          外部知識 API
        </button>
      </div>
      
      {/* 知识库网格 */}
      <div className="grid grid-cols-3 gap-4">
        <KnowledgeCard
          name="产品文档"
          documentCount={25}
          status="active"
        />
      </div>
    </div>
  );
}

function CreateKnowledgeButton() {
  return (
    <div className="relative">
      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        建立知識庫
      </button>
      
      <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border py-2">
        <a href="/datasets/create" className="block px-4 py-2 hover:bg-gray-50">
          <div className="font-medium">建立知識庫</div>
          <div className="text-xs text-gray-500">標準方式建立</div>
        </a>
        <a href="/datasets/create-from-pipeline" className="block px-4 py-2 hover:bg-gray-50">
          <div className="font-medium">從知識管線建立</div>
          <div className="text-xs text-gray-500">使用 Pipeline 處理</div>
        </a>
        <a href="/datasets/connect" className="block px-4 py-2 hover:bg-gray-50">
          <div className="font-medium">連接到外部知識庫</div>
          <div className="text-xs text-gray-500">連接外部 API</div>
        </a>
      </div>
    </div>
  );
}

function KnowledgeCard({ name, documentCount, status }: {
  name: string;
  documentCount: number;
  status: 'active' | 'processing' | 'error';
}) {
  return (
    <div className="p-4 bg-white border border-gray-200 rounded-xl hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center text-white">
            📚
          </div>
          <div>
            <h3 className="font-medium">{name}</h3>
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <span 
                className={`w-2 h-2 rounded-full ${
                  status === 'active' ? 'bg-green-500' : 'bg-gray-300'
                }`}
                data-testid="status-indicator"
              />
              <span>{documentCount} 個文檔</span>
            </div>
          </div>
        </div>
        <button className="p-1 hover:bg-gray-100 rounded">
          <i className="i-ri-more-line" />
        </button>
      </div>
    </div>
  );
}
```

---

### 4. 工具页面 (Tools) - `/tools`

**v0.dev 提示词**:

```
创建 Dify 工具页面，包含：

顶部:
- 标题: "工具"
- 搜索框
- "Dify 市場" 链接按钮

工具网格:
- 显示已安装的工具
- 每个工具卡片包含:
  - 工具图标
  - 工具名称
  - 简短描述
  - "詳" 链接（查看详情）

市场链接:
- 链接到 marketplace.dify.ai
- 带参数: source, language, theme

工具卡片样式:
- 白色背景
- 圆角边框
- Hover 阴影

使用 Tailwind CSS。
```

**代码示例**:

```tsx
// app/tools/page.tsx
export default function ToolsPage() {
  const marketplaceUrl = 'https://marketplace.dify.ai?source=https%3A%2F%2Fcloud.dify.ai&language=zh-Hant&theme=system';
  
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">工具</h1>
        
        <div className="flex items-center space-x-4">
          <SearchInput placeholder="搜尋工具..." />
          <a
            href={marketplaceUrl}
            target="_blank"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Dify 市場
          </a>
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-4">
        <ToolCard
          name="Google"
          description="Google 搜尋工具"
          icon="🔍"
          detailUrl="https://marketplace.dify.ai/plugins/langgenius/google"
        />
        <ToolCard
          name="GitHub"
          description="GitHub 整合工具"
          icon="💻"
          detailUrl="https://marketplace.dify.ai/plugins/langgenius/github"
        />
      </div>
    </div>
  );
}

function ToolCard({ name, description, icon, detailUrl }: {
  name: string;
  description: string;
  icon: string;
  detailUrl: string;
}) {
  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="font-medium mb-1">{name}</h3>
      <p className="text-sm text-gray-600 mb-3">{description}</p>
      <a
        href={detailUrl}
        target="_blank"
        className="text-sm text-blue-600 hover:underline"
      >
        詳 →
      </a>
    </div>
  );
}
```

---

### 5. 探索页面 (Explore) - `/explore/apps`

**v0.dev 提示词**:

```
创建 Dify 探索页面，包含：

顶部:
- 标题: "探索"
- 搜索框
- 分类筛选

應用程式庫标签

应用网格:
- 显示公开的应用模板
- 每个卡片显示:
  - 应用图标
  - 应用名称
  - 创建者
  - 使用次数
  - "使用" 按钮

底部提示:
- "瞭解更多" 链接到文档
- 链接: https://docs.dify.ai/en/use-dify/publish/README

使用 Tailwind CSS。
```

---

## 通用组件库

### SearchInput 组件

```tsx
function SearchInput({ placeholder }: { placeholder: string }) {
  return (
    <div className="relative">
      <i className="i-ri-search-line absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        placeholder={placeholder}
        className="
          w-64 pl-10 pr-3 py-2
          border border-transparent
          bg-[var(--components-input-bg-normal)]
          rounded-lg
          hover:border-[var(--components-input-border-hover)]
          focus:border-[var(--components-input-border-active)]
          focus:shadow-xs
          outline-none
          transition-colors
        "
      />
    </div>
  );
}
```

### Tab 组件

```tsx
function Tab({ label, active, ...props }: {
  label: string;
  active?: boolean;
  [key: string]: any;
}) {
  return (
    <button
      className={`
        px-4 py-2 text-sm font-medium border-b-2 transition-colors
        ${active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-600 hover:text-gray-900'
        }
      `}
      {...props}
    >
      {label}
    </button>
  );
}
```

### TagFilter 组件

```tsx
function TagFilter() {
  return (
    <button
      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
      data-testid="tag-filter-trigger-icon"
    >
      <span>全部標籤</span>
      <i className="i-ri-arrow-down-s-line" data-testid="tag-filter-arrow-down-icon" />
    </button>
  );
}
```

---

## CSS 变量配置

```css
/* globals.css */
:root {
  /* 输入框 */
  --components-input-bg-normal: #f9fafb;
  --components-input-bg-hover: #f3f4f6;
  --components-input-bg-active: #ffffff;
  --components-input-border-hover: #d1d5db;
  --components-input-border-active: #3b82f6;
  --components-input-text-filled: #111827;
  --components-input-text-placeholder: #9ca3af;
  
  /* 卡片 */
  --components-card-bg: #ffffff;
  --components-card-border: #e5e7eb;
  
  /* 主色 */
  --primary-600: #2563eb;
}
```

---

## 路由结构

```
/apps                          # 工作室
/datasets                      # 知识库
  /datasets/create             # 创建知识库
  /datasets/create-from-pipeline  # 从管线创建
  /datasets/connect            # 连接外部
/tools                         # 工具
/plugins                       # 插件
/explore/apps                  # 探索
```

---

## Data Attributes（用于测试）

```tsx
// Tab 切换器
data-testid="tab-slider-new"
data-testid="tab-item-all"
data-testid="tab-item-workflow"
data-testid="tab-item-advanced-chat"
data-testid="tab-item-chat"
data-testid="tab-item-agent-chat"
data-testid="tab-item-completion"

// 标签筛选
data-testid="tag-filter-trigger-icon"
data-testid="tag-filter-arrow-down-icon"

// 状态指示器
data-testid="status-indicator"

// Checkbox
data-testid="checkbox-undefined"
```

---

## 响应式设计

```tsx
// 桌面: 3列
<div className="grid grid-cols-3 gap-4">

// 平板: 2列
<div className="grid grid-cols-2 lg:grid-cols-3 gap-4">

// 手机: 1列
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

---

## 国际化支持

```tsx
// 使用 next-intl 或类似库
import { useTranslations } from 'next-intl';

function Component() {
  const t = useTranslations('studio');
  
  return (
    <h1>{t('title')}</h1> // "工作室"
  );
}
```

---

## 实现优先级

### Phase 1: 核心布局
1. 主布局和导航
2. 工作室页面（应用列表）
3. 搜索和筛选组件

### Phase 2: 功能页面
4. 知识库页面
5. 工具页面
6. 探索页面

### Phase 3: 交互功能
7. 创建应用流程
8. 创建知识库流程
9. 工具安装流程

---

## 使用建议

### 在 v0.dev 中使用

1. **复制整个页面的提示词**到 v0.dev
2. **生成后调整**颜色变量和样式
3. **添加交互逻辑**（状态管理、API 调用）
4. **测试响应式**布局

### 示例提示词（直接复制到 v0.dev）

```
创建一个 Dify 风格的工作室页面，使用 Next.js 和 Tailwind CSS。

包含:
- 顶部标题 "工作室"
- 搜索框（左侧图标，占位符 "搜尋應用..."）
- 标签筛选下拉菜单
- Tab 切换器（全部、工作流、高级聊天、聊天、Agent 聊天、完成）
- 创建应用按钮（3个选项：建立空白應用、從應用模版建立、匯入 DSL 檔案）
- 应用网格（3列，每个卡片 160px 高，圆角 12px）

样式:
- 使用 CSS 变量: --components-input-bg-normal, --components-card-bg
- 输入框 hover 时边框变色
- 卡片 hover 时阴影增强
- 使用 Remix Icon

TypeScript + Tailwind CSS
```

---

**文档结束**

*本 v0.dev 提示词基于真实 Dify Cloud 系统截图生成，包含实际的 UI 元素、CSS 类名和交互模式。可直接用于 v0.dev 生成高保真原型。*
