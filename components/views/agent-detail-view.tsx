"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import { 
  ArrowLeft,
  Bot,
  Settings,
  Play,
  Send,
  Save,
  Copy,
  RefreshCw,
  Zap,
  Database,
  FileText,
  Code,
  MessageSquare,
  Trash2,
  Plus,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  User
} from "lucide-react"

interface AgentDetailViewProps {
  agentId?: string
  onBack?: () => void
}

const skillsList = [
  { id: "sk-1", name: "客服意图识别", type: "NLU", status: "active" },
  { id: "sk-2", name: "产品知识检索", type: "RAG", status: "active" },
  { id: "sk-3", name: "工单创建", type: "Action", status: "active" },
  { id: "sk-4", name: "情感分析", type: "Analysis", status: "inactive" },
]

const knowledgeBases = [
  { id: "kb-1", name: "产品手册", docs: 156, status: "ready" },
  { id: "kb-2", name: "FAQ 集合", docs: 89, status: "ready" },
  { id: "kb-3", name: "技术文档", docs: 234, status: "indexing" },
]

const testCases = [
  { 
    id: "tc-1", 
    input: "我的订单什么时候能到？", 
    expectedOutput: "查询订单状态并提供预计送达时间",
    actualOutput: "好的，我来帮您查询订单状态。您的订单 #12345 预计将于明天下午送达。",
    status: "passed",
    latency: 1.2
  },
  { 
    id: "tc-2", 
    input: "产品有质量问题想退货", 
    expectedOutput: "引导用户进入退货流程并收集信息",
    actualOutput: "非常抱歉给您带来不便。我可以帮您处理退货申请。请问您能描述一下具体的质量问题吗？",
    status: "passed",
    latency: 1.5
  },
  { 
    id: "tc-3", 
    input: "你们公司在哪里", 
    expectedOutput: "提供公司地址和联系方式",
    actualOutput: "我们的总部位于上海市浦东新区...",
    status: "passed",
    latency: 0.8
  },
  { 
    id: "tc-4", 
    input: "我要投诉你们的服务态度", 
    expectedOutput: "表达歉意并转接人工客服",
    actualOutput: "对不起让您有不好的体验，我马上为您转接人工客服处理。",
    status: "warning",
    latency: 2.1
  },
]

const conversationHistory = [
  { role: "user", content: "你好，我想咨询一下产品问题", timestamp: "14:32:15" },
  { role: "assistant", content: "您好！我是智能客服小助手，很高兴为您服务。请问您想咨询哪款产品呢？", timestamp: "14:32:16" },
  { role: "user", content: "你们的 Pro Max 版本和标准版有什么区别？", timestamp: "14:32:45" },
  { role: "assistant", content: "Pro Max 版本相比标准版主要有以下几点升级：\n\n1. **处理能力**：Pro Max 采用最新一代芯片，性能提升 40%\n2. **存储空间**：提供 256GB 起步，标准版为 128GB\n3. **电池续航**：续航时间延长约 2 小时\n4. **摄像系统**：配备三摄系统，支持 5 倍光学变焦\n\n您比较关注哪个方面呢？", timestamp: "14:32:47" },
]

export function AgentDetailView({ onBack }: AgentDetailViewProps) {
  const [temperature, setTemperature] = useState([0.7])
  const [maxTokens, setMaxTokens] = useState([2048])
  const [testInput, setTestInput] = useState("")
  const [isRunning, setIsRunning] = useState(false)

  const handleRunTest = () => {
    setIsRunning(true)
    setTimeout(() => setIsRunning(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground">智能客服助手</h1>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                  已发布
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">ID: agent_cs_001 · 最后更新: 2024-06-15 14:30</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Copy className="h-4 w-4" />
            复制 Agent
          </Button>
          <Button className="gap-2 bg-primary hover:bg-primary/90">
            <Save className="h-4 w-4" />
            保存更改
          </Button>
        </div>
      </div>

      <Tabs defaultValue="config" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            基础配置
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-2">
            <Zap className="h-4 w-4" />
            技能绑定
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-2">
            <Database className="h-4 w-4" />
            知识库
          </TabsTrigger>
          <TabsTrigger value="debug" className="gap-2">
            <Play className="h-4 w-4" />
            调试测试
          </TabsTrigger>
          <TabsTrigger value="prompts" className="gap-2">
            <FileText className="h-4 w-4" />
            Prompt 模板
          </TabsTrigger>
        </TabsList>

        {/* 基础配置 */}
        <TabsContent value="config" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">基本信息</CardTitle>
                <CardDescription>配置 Agent 的基本属性</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Agent 名称</Label>
                  <Input defaultValue="智能客服助手" className="bg-background border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">描述</Label>
                  <Textarea 
                    defaultValue="为客户提供 7x24 小时智能客服服务，支持产品咨询、订单查询、售后处理等场景。"
                    className="bg-background border-border min-h-[80px]" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Agent 类型</Label>
                  <Select defaultValue="chatbot">
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="chatbot">对话机器人</SelectItem>
                      <SelectItem value="assistant">智能助手</SelectItem>
                      <SelectItem value="workflow">工作流 Agent</SelectItem>
                      <SelectItem value="rag">RAG Agent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-foreground">启用状态</Label>
                    <p className="text-sm text-muted-foreground">是否对外提供服务</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">模型配置</CardTitle>
                <CardDescription>设置 AI 模型参数</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-foreground">基础模型</Label>
                  <Select defaultValue="gpt4-turbo">
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="gpt4-turbo">GPT-4 Turbo</SelectItem>
                      <SelectItem value="gpt4">GPT-4</SelectItem>
                      <SelectItem value="gpt35">GPT-3.5 Turbo</SelectItem>
                      <SelectItem value="claude3">Claude 3 Opus</SelectItem>
                      <SelectItem value="qwen">通义千问 Max</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-foreground">Temperature</Label>
                    <span className="text-sm text-muted-foreground">{temperature[0]}</span>
                  </div>
                  <Slider
                    value={temperature}
                    onValueChange={setTemperature}
                    max={1}
                    step={0.1}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">较低的值使输出更确定，较高的值使输出更随机</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-foreground">Max Tokens</Label>
                    <span className="text-sm text-muted-foreground">{maxTokens[0]}</span>
                  </div>
                  <Slider
                    value={maxTokens}
                    onValueChange={setMaxTokens}
                    max={4096}
                    step={128}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-foreground">启用流式输出</Label>
                    <p className="text-sm text-muted-foreground">逐字输出响应内容</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 技能绑定 */}
        <TabsContent value="skills" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-foreground">已绑定技能</CardTitle>
                <CardDescription>管理 Agent 可调用的技能</CardDescription>
              </div>
              <Button className="gap-2 bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                添加技能
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {skillsList.map((skill) => (
                  <div 
                    key={skill.id} 
                    className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Zap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{skill.name}</p>
                          <Badge variant="secondary">{skill.type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">skill_{skill.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch defaultChecked={skill.status === "active"} />
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 知识库 */}
        <TabsContent value="knowledge" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-foreground">关联知识库</CardTitle>
                <CardDescription>选择 Agent 可以访问的知识库</CardDescription>
              </div>
              <Button className="gap-2 bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                关联知识库
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {knowledgeBases.map((kb) => (
                  <div 
                    key={kb.id} 
                    className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Database className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{kb.name}</p>
                        <p className="text-sm text-muted-foreground">{kb.docs} 个文档</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {kb.status === "ready" ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                          就绪
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                          索引中
                        </Badge>
                      )}
                      <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                        配置
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 调试测试 */}
        <TabsContent value="debug" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 对话测试区 */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">对话调试</CardTitle>
                <CardDescription>实时测试 Agent 的对话能力</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-[400px] rounded-lg border border-border bg-muted/20 p-4">
                  <div className="space-y-4">
                    {conversationHistory.map((msg, idx) => (
                      <div 
                        key={idx} 
                        className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          msg.role === "user" 
                            ? "bg-primary/20" 
                            : "bg-gradient-to-br from-primary to-accent"
                        }`}>
                          {msg.role === "user" ? (
                            <User className="h-4 w-4 text-primary" />
                          ) : (
                            <Bot className="h-4 w-4 text-primary-foreground" />
                          )}
                        </div>
                        <div className={`max-w-[80%] ${msg.role === "user" ? "text-right" : ""}`}>
                          <div className={`inline-block rounded-lg px-4 py-2 ${
                            msg.role === "user" 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-muted/50 text-foreground"
                          }`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{msg.timestamp}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                
                <div className="flex gap-2">
                  <Input 
                    placeholder="输入测试消息..." 
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    className="bg-background border-border"
                  />
                  <Button 
                    className="gap-2 bg-primary hover:bg-primary/90"
                    onClick={handleRunTest}
                    disabled={isRunning}
                  >
                    {isRunning ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 测试用例 */}
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-foreground">测试用例</CardTitle>
                  <CardDescription>预定义的测试场景</CardDescription>
                </div>
                <Button variant="outline" className="gap-2">
                  <Play className="h-4 w-4" />
                  运行全部
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[450px]">
                  <div className="space-y-3">
                    {testCases.map((tc) => (
                      <div 
                        key={tc.id} 
                        className="p-4 rounded-lg border border-border bg-muted/20"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {tc.status === "passed" ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-amber-500" />
                            )}
                            <span className="text-sm font-medium text-foreground">{tc.id}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {tc.latency}s
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-muted-foreground">输入</p>
                            <p className="text-sm text-foreground">{tc.input}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">实际输出</p>
                            <p className="text-sm text-foreground line-clamp-2">{tc.actualOutput}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Prompt 模板 */}
        <TabsContent value="prompts" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">System Prompt</CardTitle>
              <CardDescription>定义 Agent 的角色和行为准则</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                className="bg-background border-border font-mono text-sm min-h-[300px]"
                defaultValue={`你是一个专业的智能客服助手，为用户提供产品咨询和售后服务支持。

## 角色定义
- 名称：小智
- 角色：智能客服专员
- 语言：简体中文

## 行为准则
1. 始终保持友好、专业的态度
2. 回答问题时要准确、简洁
3. 如遇到无法解决的问题，及时转接人工客服
4. 保护用户隐私，不泄露敏感信息

## 知识范围
- 产品功能和规格咨询
- 订单状态查询
- 退换货流程
- 常见问题解答

## 限制
- 不讨论政治、宗教等敏感话题
- 不提供医疗、法律等专业建议
- 不执行任何可能损害用户利益的操作`}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-2">
                  <Code className="h-4 w-4" />
                  查看变量
                </Button>
                <Button className="gap-2 bg-primary hover:bg-primary/90">
                  <Save className="h-4 w-4" />
                  保存 Prompt
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
