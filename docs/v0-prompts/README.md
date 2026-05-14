# v0.dev 提示词文件集

## 使用方法

1. 打开 [v0.dev](https://v0.dev)
2. 新建对话
3. 复制对应文件的**全部内容**，粘贴到 v0.dev 输入框
4. 发送，等待生成
5. 根据效果继续追加调整

## 文件列表（按执行顺序）

| 文件 | 内容 | 建议顺序 |
|------|------|---------|
| `01_design-system.md` | 设计系统 + 颜色 Token（每次新项目必须先发送） | 第 1 步 |
| `02_canvas-page.md` | 整体画布页面布局 + Header | 第 2 步 |
| `03_node-cards.md` | 全部 30 种节点卡片 | 第 3 步 |
| `04_node-panels-llm-code-ifelse.md` | LLM / Code / IfElse 配置面板 | 第 4 步 |
| `05_node-panels-http-knowledge-iteration.md` | HTTP / Knowledge / Iteration / Loop 配置面板 | 第 5 步 |
| `06_node-panels-agent-answer-end-others.md` | Agent / Answer / End / QC / PE / Template / Assigner / HumanInput / Trigger 配置面板 | 第 6 步 |
| `07_run-debug-panel.md` | 运行调试面板（Result / Detail / Tracing 三 Tab） | 第 7 步 |
| `08_chatflow-preview.md` | Chatflow 对话预览面板（三 Tab 版） | 第 8 步 |
| `09_panels-version-env-blockselector.md` | 版本历史 / 环境变量 / Block Selector 面板 | 第 9 步 |
| `10_advanced-components.md` | ChecklistModal / CommentsPanel / NoteNode 编辑器 | 第 10 步 |
| `11_canvas-interactions.md` | 底部操作栏 / 控制模式 / 右键菜单 / 快捷键弹窗 | 第 11 步 |

## 注意事项

- 每个文件可以独立发送，不依赖前一个文件的生成结果
- 如果 v0.dev 生成效果不理想，在同一对话中追加："请参考以下 TSX 代码调整样式：[粘贴对应章节的 TSX]"
- 设计系统文件（01）建议在每个新对话开始时都先发送一次
