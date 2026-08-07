# AIPaddle

AIPaddle 是企業 AI 資產、能力、業務角色與運行治理平台。本詞彙表定義產品與開發共同使用的核心領域語言。

## 業務角色與執行

**數字員工團隊（Digital Employee Team）**:
為共同業務目標協作的數字員工集合；跨員工協作由團隊 Workflow 編排。
_Avoid_: Agent 團隊、多 Agent 群組

**數字員工（Digital Employee）**:
面向業務、具有身份與職責的 AI 工作角色，由一個或多個 Agent 及其 Workflow 組成。
_Avoid_: 已發布 Agent、Agent 展示卡

**Agent**:
具有模型、策略、指令與資源綁定的最小自主執行單元；不可引用其他 Agent。
_Avoid_: 數字員工、子 Agent、嵌套 Agent

**Workflow**:
以可追蹤節點和控制流編排 Agent、Tool、Skill 與知識庫的可執行流程；多 Agent 協作必須經 Workflow。
_Avoid_: Skill、Agent 嵌套

**Agent Strategy**:
定義 Agent 如何推理、選擇 Tool、循環和停止的運行策略。
_Avoid_: Workflow、Skill

## 能力與知識

**Plugin**:
可安裝、升級、停用和卸載的能力交付包；可提供 MCP、API 或 DB 類 Provider 及其 Tools。
_Avoid_: Tool、Skill

**Tool**:
具有明確輸入輸出契約、可被 Agent、Workflow 或 Skill 結構化調用的原子操作。
_Avoid_: Plugin、MCP Server、Skill

**Skill**:
指導 Agent 如何完成一類業務工作的可複用方法，包含 SOP、Prompt、規則、示例及 Tool／知識庫依賴；不可調用 Workflow。
_Avoid_: Agent Skill、API Skill、MCP Skill、Workflow Skill

**MCP Server**:
以 Model Context Protocol 暴露一組工具的 Tool Provider；平台業務資產引用受治理 Tool，不直接引用整個 Server。
_Avoid_: MCP Skill、Tool

**Data Connector**:
由 Plugin 提供、用於把一類外部資料系統接入 AIPaddle 的連接能力。
_Avoid_: Data Source、Tool

**Data Source**:
租戶透過 Data Connector 配置出的具體外部資料來源實例。
_Avoid_: Data Connector、Knowledge Base

**Knowledge Base**:
接收文件或 Data Source 同步內容，並提供切片、索引及檢索的企業知識資產。
_Avoid_: Data Source、文件目錄

**Trigger**:
由時間或外部事件啟動 Agent、數字員工或 Workflow 運行的能力。
_Avoid_: Schedule、Workflow Start 節點

**Extension（擴展能力）**:
把 AIPaddle 的 Agent、數字員工或 Workflow 發布給其他應用調用的受治理入口。
_Avoid_: Plugin、Tool、Connector
