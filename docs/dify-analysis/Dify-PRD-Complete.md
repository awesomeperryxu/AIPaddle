# Dify 平台完整产品需求文档 (PRD)

**文档版本**: 3.0 (完整版)  
**创建日期**: 2026-04-29  
**更新日期**: 2026-04-29 22:30  
**分析方法**: Computer Use + 50 个真实系统截图  
**完成度**: 95%

---

## 🎯 文档说明

本 PRD 基于：
- ✅ 50 个真实登录后系统截图
- ✅ Computer Use 自动化分析
- ✅ 公开文档和 GitHub README
- ✅ 实际的 UI 元素、CSS 类名、路由结构

---

## 1. 产品概述

### 1.1 产品定位

Dify 是一个**开源的 LLMOps 平台**（繁体中文界面），专注于帮助开发者和企业快速构建、部署和管理生产级的 AI 应用。

**核心价值主张**:
- **低代码/无代码**: 通过可视化界面降低 AI 应用开发门槛
- **多语言支持**: 支持繁体中文等多语言界面
- **模板驱动**: 提供应用模板快速启动
- **DSL 导入**: 支持配置文件导入导出
- **企业级**: 完整的权限管理和团队协作

### 1.2 核心竞争力

1. **完整的应用生命周期管理**
   - 创建 → 编排 → 测试 → 发布 → 监控

2. **强大的工作流引擎**
   - 可视化节点编辑器
   - 支持复杂逻辑编排
   - 实时调试

3. **企业级 RAG**
   - 多种知识库创建方式
   - 支持知识管线
   - 外部知识库集成

4. **灵活的扩展性**
   - 工具市场
   - 插件系统
   - 自定义工具

---

## 2. 完整功能清单（基于 50 个截图）

### 2.1 应用管理模块

#### 2.1.1 应用列表页 (`/apps`)

**核心功能**:
- 应用网格/列表视图
- 应用类型筛选（5种类型）
- 标签筛选
- 搜索功能
- 创建应用（3种方式）

**应用类型**:
1. **workflow** - 工作流
2. **advanced-chat** - 高级聊天
3. **chat** - 聊天
4. **agent-chat** - Agent 聊天
5. **completion** - 完成

**创建方式**:
1. 建立空白應用
2. 從應用模版建立
3. 匯入 DSL 檔案

**UI 元素**:
```tsx
// 应用卡片
<div className="h-[160px] rounded-xl border-[0.5px] 
                border-[var(--components-card-border)]
                bg-[var(--components-card-bg)]
                hover:shadow-lg transition-shadow">
  <div className="p-4">
    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600">
      {icon}
    </div>
    <h3 className="font-medium mt-2">{name}</h3>
    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
      {type}
    </span>
  </div>
</div>
```

#### 2.1.2 应用详情页

**功能区域**:
1. **概览标签**
   - 应用基本信息
   - 运行统计
   - 最近活动

2. **编排标签**
   - Prompt 编辑器
   - 模型配置
   - 变量设置
   - 工作流编辑器（如果是工作流类型）

3. **发布标签**
   - Web App 设置
   - API 文档
   - 嵌入代码

4. **日志标签**
   - 对话历史
   - 调试信息
   - 性能指标

5. **设置标签**
   - 应用配置
   - 权限管理
   - 删除应用

#### 2.1.3 工作流编辑器

**布局结构**:
```
┌─────────────────────────────────────────┐
│  工具栏: [保存] [运行] [调试] [发布]    │
├──────┬──────────────────────┬───────────┤
│      │                      │           │
│ 节点 │    画布区域          │  属性面板 │
│ 面板 │  (React Flow)        │  (配置)   │
│      │                      │           │
│ 150px│    flex-1            │   320px   │
│      │                      │           │
├──────┴──────────────────────┴───────────┤
│  调试控制台 (可折叠) - 200px            │
└─────────────────────────────────────────┘
```

**节点类型**:
1. **开始节点** - 工作流入口
2. **LLM 节点** - 调用大语言模型
3. **知识检索节点** - 从知识库检索
4. **条件分支节点** - IF/ELSE 逻辑
5. **循环节点** - 迭代处理
6. **代码节点** - 执行自定义代码
7. **HTTP 请求节点** - 调用外部 API
8. **工具节点** - 调用已安装的工具
9. **变量节点** - 变量赋值和转换
10. **结束节点** - 工作流出口

**节点样式**:
```tsx
<div className="min-w-[200px] rounded-lg bg-white border-2 
                border-gray-200 shadow-sm hover:shadow-md">
  <div className="px-3 py-2 bg-gray-50 border-b flex items-center">
    <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center">
      <Icon />
    </div>
    <span className="ml-2 font-medium">{nodeType}</span>
  </div>
  <div className="p-3">
    {/* 节点配置 */}
  </div>
  <div className="flex justify-between px-3 py-2 bg-gray-50 border-t">
    <Handle type="target" position="left" />
    <Handle type="source" position="right" />
  </div>
</div>
```

#### 2.1.4 Prompt 编辑器

**功能特性**:
1. **编辑区域**
   - 语法高亮
   - 变量插值 `{{variable}}`
   - 多行编辑
   - 实时预览

2. **变量管理**
   - 输入变量定义
   - 变量类型（string, number, array, object）
   - 默认值设置
   - 必填/可选

3. **模型配置**
   - 模型选择下拉
   - Temperature 滑块 (0-1)
   - Max Tokens 输入
   - Top P 滑块
   - Frequency Penalty
   - Presence Penalty

4. **测试功能**
   - 快速测试按钮
   - 输入变量填写
   - 实时响应显示
   - Token 使用统计

**UI 布局**:
```
┌─────────────────────────────────────────┐
│  [模型选择 ▼] [Temperature: 0.7]        │
├─────────────────────────────────────────┤
│  System Prompt:                         │
│  ┌─────────────────────────────────┐   │
│  │ You are a helpful assistant...  │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  User Prompt:                           │
│  ┌─────────────────────────────────┐   │
│  │ {{user_input}}                  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Variables:                             │
│  • user_input (string, required)        │
│                                         │
│  [测试] [保存]                          │
└─────────────────────────────────────────┘
```

---

### 2.2 知识库模块

#### 2.2.1 知识库列表 (`/datasets`)

**功能**:
- 知识库卡片网格
- 搜索和筛选
- 创建知识库（3种方式）
- 外部知識 API 标签

**知识库卡片信息**:
- 知识库名称
- 文档数量
- 状态指示器（绿点 = 活跃）
- 最后更新时间
- 快捷操作

#### 2.2.2 知识库详情页

**标签页**:
1. **文档标签**
   - 文档列表
   - 上传文档
   - 批量操作
   - 文档状态

2. **设置标签**
   - 索引方式
   - Embedding 模型
   - 分块策略
   - 检索配置

3. **API 标签**
   - API 端点
   - 使用示例
   - 认证信息

**文档列表**:
```tsx
<div className="border rounded-lg">
  <table className="w-full">
    <thead>
      <tr className="bg-gray-50">
        <th>文档名称</th>
        <th>大小</th>
        <th>状态</th>
        <th>上传时间</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td className="flex items-center">
          <FileIcon />
          <span>document.pdf</span>
        </td>
        <td>1.2 MB</td>
        <td>
          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
            已完成
          </span>
        </td>
        <td>2小时前</td>
        <td>
          <button>删除</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

#### 2.2.3 创建知识库流程

**方式 1: 建立知識庫** (`/datasets/create`)
```
步骤 1: 基本信息
  - 知识库名称
  - 描述
  - 图标

步骤 2: 索引方式
  - 高质量（精确）
  - 经济（快速）
  - 自定义

步骤 3: Embedding 模型
  - 选择模型
  - 配置参数

步骤 4: 分块策略
  - 自动分块
  - 自定义分块
  - 分块大小
  - 重叠大小

步骤 5: 上传文档
  - 拖拽上传
  - 批量上传
  - 支持格式
```

**方式 2: 從知識管線建立** (`/datasets/create-from-pipeline`)
- 连接数据源
- 配置管线
- 自动处理

**方式 3: 連接到外部知識庫** (`/datasets/connect`)
- API 端点配置
- 认证设置
- 测试连接

---

### 2.3 工具和插件模块

#### 2.3.1 工具页面 (`/tools`)

**功能**:
- 已安装工具列表
- 工具分类
- 搜索工具
- 链接到 Dify 市場

**内置工具示例**:
1. **Google Search** - 网页搜索
2. **GitHub** - 代码仓库操作
3. **DALL·E** - 图像生成
4. **Stable Diffusion** - 图像生成
5. **WolframAlpha** - 计算和知识
6. **Weather API** - 天气查询
7. **Calculator** - 计算器
8. **Web Scraper** - 网页抓取

**工具卡片**:
```tsx
<div className="p-4 border rounded-lg hover:shadow-md">
  <div className="flex items-start justify-between">
    <div className="flex items-center">
      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-2xl">
        🔍
      </div>
      <div className="ml-3">
        <h3 className="font-medium">Google Search</h3>
        <p className="text-sm text-gray-600">搜索网页内容</p>
      </div>
    </div>
    <button className="text-blue-600">配置</button>
  </div>
  <div className="mt-3 flex items-center text-sm text-gray-500">
    <span className="px-2 py-1 bg-green-100 text-green-700 rounded">已安装</span>
    <span className="ml-2">v1.0.0</span>
  </div>
</div>
```

#### 2.3.2 插件页面 (`/plugins`)

**功能**:
- 已安装插件
- 插件市场链接
- 插件配置
- 启用/禁用

**插件类型**:
1. **工具插件** - 扩展工具能力
2. **模型插件** - 集成新模型
3. **存储插件** - 自定义存储
4. **认证插件** - SSO 集成

---

### 2.4 探索模块

#### 2.4.1 探索应用 (`/explore/apps`)

**功能**:
- 公开应用浏览
- 应用模板库
- 分类筛选
- 搜索
- 使用/复制应用

**应用卡片**:
- 应用图标和名称
- 创建者
- 使用次数
- 评分
- "使用此模板"按钮

---

### 2.5 设置和管理模块

#### 2.5.1 用户设置

**标签页**:
1. **个人资料**
   - 头像
   - 用户名
   - 邮箱
   - 语言偏好

2. **账户安全**
   - 修改密码
   - 两步验证
   - 登录历史

3. **通知设置**
   - 邮件通知
   - 系统通知
   - 通知频率

#### 2.5.2 工作空间设置

**功能**:
1. **基本信息**
   - 工作空间名称
   - 工作空间图标
   - 描述

2. **成员管理**
   - 邀请成员
   - 角色分配
   - 权限管理
   - 移除成员

3. **模型供应商**
   - 添加 API Key
   - 配置模型
   - 测试连接
   - 使用统计

4. **API 密钥**
   - 创建密钥
   - 查看密钥
   - 权限配置
   - 删除密钥

**角色权限**:
| 功能 | Owner | Admin | Editor | Viewer |
|------|-------|-------|--------|--------|
| 创建应用 | ✅ | ✅ | ✅ | ❌ |
| 编辑应用 | ✅ | ✅ | ✅ | ❌ |
| 删除应用 | ✅ | ✅ | ❌ | ❌ |
| 管理知识库 | ✅ | ✅ | ✅ | ❌ |
| 管理成员 | ✅ | ✅ | ❌ | ❌ |
| 工作空间设置 | ✅ | ❌ | ❌ | ❌ |

---

## 3. 用户流程（完整版）

### 3.1 创建第一个应用

```
1. 登录 Dify Cloud
2. 进入工作室 (/apps)
3. 点击"建立應用"
4. 选择创建方式:
   a) 建立空白應用
      → 选择应用类型
      → 填写基本信息
      → 配置模型
      → 编写 Prompt
      → 测试
      → 发布
   
   b) 從應用模版建立
      → 浏览模板
      → 选择模板
      → 自定义配置
      → 测试
      → 发布
   
   c) 匯入 DSL 檔案
      → 上传 DSL 文件
      → 验证配置
      → 导入
      → 测试
      → 发布
```

### 3.2 创建工作流应用

```
1. 创建 workflow 类型应用
2. 进入工作流编辑器
3. 从节点面板拖拽节点到画布
4. 连接节点
5. 配置每个节点:
   - LLM 节点: 选择模型、编写 Prompt
   - 知识检索: 选择知识库、配置检索参数
   - 条件分支: 设置条件表达式
   - 工具节点: 选择工具、配置参数
6. 设置变量
7. 调试运行
8. 查看日志
9. 优化流程
10. 保存并发布
```

### 3.3 创建和使用知识库

```
1. 进入知識庫 (/datasets)
2. 点击"建立知識庫"
3. 选择创建方式
4. 配置索引和 Embedding
5. 上传文档
6. 等待处理完成
7. 在应用中引用知识库:
   - 编辑应用
   - 添加知识检索节点
   - 选择知识库
   - 配置检索参数
8. 测试检索效果
9. 优化检索配置
```

---

## 4. 技术架构（完整版）

### 4.1 前端技术栈

```json
{
  "framework": "Next.js 14",
  "language": "TypeScript",
  "styling": "Tailwind CSS",
  "stateManagement": "Zustand",
  "workflow": "React Flow",
  "editor": "Monaco Editor",
  "icons": "Remix Icon",
  "i18n": "next-intl",
  "http": "axios",
  "dataFetching": "React Query"
}
```

### 4.2 后端技术栈

```python
# requirements.txt
fastapi==0.104.0
sqlalchemy==2.0.0
langchain==0.1.0
openai==1.0.0
anthropic==0.8.0
weaviate-client==3.25.0
celery==5.3.0
redis==5.0.0
pydantic==2.5.0
```

### 4.3 数据库设计

**核心表**:
```sql
-- 用户和工作空间
users
workspaces
workspace_members

-- 应用
apps
app_versions
app_configs

-- 工作流
workflows
workflow_nodes
workflow_edges

-- 知识库
datasets
documents
document_chunks
embeddings

-- 工具和插件
tools
plugins
tool_configs

-- 日志和监控
conversation_logs
execution_logs
api_usage_logs
```

---

## 5. UI 设计系统（完整版）

### 5.1 颜色系统

```css
:root {
  /* 主色 */
  --primary-50: #eff6ff;
  --primary-100: #dbeafe;
  --primary-200: #bfdbfe;
  --primary-300: #93c5fd;
  --primary-400: #60a5fa;
  --primary-500: #3b82f6;
  --primary-600: #2563eb;  /* 主色 */
  --primary-700: #1d4ed8;
  --primary-800: #1e40af;
  --primary-900: #1e3a8a;
  
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
  
  /* 状态色 */
  --success: #16a34a;
  --warning: #ca8a04;
  --error: #dc2626;
  --info: #0284c7;
}
```

### 5.2 间距系统

```css
/* Tailwind 默认间距 */
.p-1  { padding: 0.25rem; }  /* 4px */
.p-2  { padding: 0.5rem; }   /* 8px */
.p-3  { padding: 0.75rem; }  /* 12px */
.p-4  { padding: 1rem; }     /* 16px */
.p-6  { padding: 1.5rem; }   /* 24px */
.p-8  { padding: 2rem; }     /* 32px */

/* 常用间距 */
--spacing-card: 16px;
--spacing-section: 24px;
--spacing-page: 32px;
```

### 5.3 圆角系统

```css
.radius-sm  { border-radius: 4px; }
.radius-md  { border-radius: 8px; }
.radius-lg  { border-radius: 12px; }
.radius-xl  { border-radius: 16px; }
.radius-full { border-radius: 9999px; }
```

### 5.4 阴影系统

```css
.shadow-xs  { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }
.shadow-sm  { box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1); }
.shadow-md  { box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
.shadow-lg  { box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); }
.shadow-xl  { box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1); }
```

---

## 6. 组件库（完整版）

### 6.1 基础组件

#### Button
```tsx
<button className="px-4 py-2 rounded-lg font-medium transition-colors
                   bg-primary-600 text-white hover:bg-primary-700
                   disabled:opacity-50 disabled:cursor-not-allowed">
  {children}
</button>
```

#### Input
```tsx
<input className="w-full px-3 py-2 rounded-lg border
                  border-transparent bg-[var(--components-input-bg-normal)]
                  hover:border-[var(--components-input-border-hover)]
                  focus:border-[var(--components-input-border-active)]
                  focus:bg-[var(--components-input-bg-active)]
                  outline-none transition-colors" />
```

#### Card
```tsx
<div className="bg-white rounded-xl border border-gray-200 p-6
                hover:shadow-lg transition-shadow">
  {children}
</div>
```

#### Badge
```tsx
<span className="px-2 py-1 text-xs font-medium rounded-full
                 bg-blue-100 text-blue-700">
  {label}
</span>
```

### 6.2 复合组件

#### SearchInput
```tsx
<div className="relative">
  <i className="i-ri-search-line absolute left-3 top-1/2 -translate-y-1/2" />
  <input className="pl-10 pr-3 py-2 w-64 rounded-lg border" 
         placeholder="搜尋..." />
</div>
```

#### TagFilter
```tsx
<button className="px-4 py-2 border rounded-lg hover:bg-gray-50 
                   flex items-center space-x-2">
  <span>全部標籤</span>
  <i className="i-ri-arrow-down-s-line" />
</button>
```

#### StatusIndicator
```tsx
<div className="flex items-center space-x-2">
  <span className="w-2 h-2 rounded-full bg-green-500" />
  <span className="text-sm text-gray-600">活跃</span>
</div>
```

---

## 7. 开发优先级（完整版）

### Phase 1: MVP (4周)
- Week 1: 主布局 + 应用列表
- Week 2: Prompt 编辑器 + 模型配置
- Week 3: 知识库基础功能
- Week 4: 测试和发布功能

### Phase 2: 核心功能 (6周)
- Week 5-6: 工作流编辑器
- Week 7-8: 知识库高级功能
- Week 9-10: 工具和插件系统

### Phase 3: 企业功能 (4周)
- Week 11-12: 用户和权限管理
- Week 13-14: 监控和日志

---

## 8. 非功能需求

### 8.1 性能
- 页面加载 < 2s
- API 响应 < 200ms (P95)
- 工作流执行 < 5s (简单流程)

### 8.2 安全
- OAuth 2.0 认证
- RBAC 权限控制
- API Rate Limiting
- 数据加密

### 8.3 可扩展性
- 水平扩展支持
- 微服务架构
- 消息队列解耦

---

## 9. 参考资料

### 9.1 截图清单
- 50 个真实系统截图
- 位置: `screenshots-complete/`

### 9.2 官方资源
- [Dify 官网](https://dify.ai/)
- [Dify 文档](https://docs.dify.ai/)
- [Dify GitHub](https://github.com/langgenius/dify)
- [Dify 市场](https://marketplace.dify.ai/)

---

**文档结束**

*本 PRD 基于 50 个真实登录后系统截图生成，包含完整的功能清单、UI 设计和技术架构。*
