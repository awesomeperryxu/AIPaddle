'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { mockAgents, Agent } from '@/lib/mock-data';
import { apiFetch } from '@/lib/api/client';

type ChatMsg = { role: 'user' | 'assistant'; content: string };
import {
  Search,
  MessageSquare,
  Send,
  Paperclip,
  Phone,
  MessagesSquare,
  Clock,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function AgentsView({ agents }: { agents?: Agent[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [message, setMessage] = useState('');

  // 真实对话（4.1.4）
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [sending, setSending] = useState(false);

  // 选择 Agent：切换并清空上一段对话
  function selectAgent(agent: Agent) {
    setSelectedAgent(agent);
    setMessages([]);
    setMessage('');
  }

  async function handleSend(text?: string) {
    const content = (text ?? message).trim();
    if (!content || sending || !selectedAgent) return;
    const next: ChatMsg[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setMessage('');
    setSending(true);
    try {
      const res = await apiFetch<{ reply: string }>(`/api/agents/${selectedAgent.id}/chat`, {
        method: 'POST',
        body: JSON.stringify({ messages: next }),
      });
      setMessages([...next, { role: 'assistant', content: res.reply }]);
    } catch (e) {
      setMessages([...next, { role: 'assistant', content: `⚠️ ${e instanceof Error ? e.message : '对话失败'}` }]);
    } finally {
      setSending(false);
    }
  }

  const publishedAgents = agents && agents.length > 0 ? agents : mockAgents.filter(a => a.status === 'published');
  const filteredAgents = publishedAgents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-full gap-5">
      {/* Agent List */}
      <div className={`flex flex-col ${selectedAgent ? 'w-72' : 'flex-1'}`}>
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-foreground">数字员工</h1>
          <p className="text-sm text-muted-foreground mt-0.5">选择一个 Agent 开始对话</p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索 Agent..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card border-border h-9"
          />
        </div>

        {/* Recent Used */}
        {!selectedAgent && (
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">最近使用</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {publishedAgents.slice(0, 3).map((agent) => (
                <button
                  key={agent.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors shrink-0"
                  onClick={() => selectAgent(agent)}
                >
                  <span className="text-base">{agent.avatar}</span>
                  <span className="text-sm text-foreground">{agent.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Agent Grid/List */}
        <div className={`flex-1 overflow-y-auto ${selectedAgent ? 'space-y-2' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 content-start'}`}>
          {filteredAgents.map((agent) => (
            <Card
              key={agent.id}
              className={`bg-card border-border cursor-pointer transition-all hover:shadow-md ${
                selectedAgent?.id === agent.id ? 'ring-2 ring-primary shadow-md' : 'shadow-sm'
              }`}
              onClick={() => selectAgent(agent)}
            >
              <CardContent className={`${selectedAgent ? 'p-3' : 'p-4'}`}>
                <div className="flex items-start gap-3">
                  <div className={`${selectedAgent ? 'w-9 h-9' : 'w-11 h-11'} rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center ${selectedAgent ? 'text-lg' : 'text-xl'} shrink-0`}>
                    {agent.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className={`font-medium text-foreground truncate ${selectedAgent ? 'text-sm' : ''}`}>{agent.name}</h3>
                    </div>
                    <p className={`text-muted-foreground ${selectedAgent ? 'text-xs line-clamp-1' : 'text-sm line-clamp-2'}`}>{agent.description}</p>
                    {!selectedAgent && (
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{agent.department}</Badge>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {agent.calls.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                  {selectedAgent && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      {selectedAgent && (
        <div className="flex-1 flex flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {/* Chat Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-lg">
                {selectedAgent.avatar}
              </div>
              <div>
                <h2 className="text-sm font-medium text-foreground">{selectedAgent.name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{selectedAgent.department}</Badge>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    在线
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                本地CC
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1.5">
                <MessagesSquare className="h-3.5 w-3.5" />
                企微
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                历史
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Welcome Message */}
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-xs">
                  {selectedAgent.avatar}
                </AvatarFallback>
              </Avatar>
              <div className="max-w-[75%]">
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border rounded-tl-sm">
                  <p className="text-sm text-foreground leading-relaxed">
                    你好！我是{selectedAgent.name}。{selectedAgent.description}
                    <br /><br />
                    有什么可以帮助你的吗？
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">刚刚</p>
              </div>
            </div>

            {/* 真实对话消息 */}
            {messages.map((msg, index) => (
              <div
                key={index}
                data-testid={msg.role === 'assistant' ? 'chat-message-assistant' : undefined}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className={
                    msg.role === 'user'
                      ? 'bg-primary/10 text-primary text-xs'
                      : 'bg-gradient-to-br from-primary/20 to-accent/20 text-xs'
                  }>
                    {msg.role === 'user' ? '你' : selectedAgent.avatar}
                  </AvatarFallback>
                </Avatar>
                <div className={`max-w-[75%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <div className={`p-3.5 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted/40 border border-border rounded-tl-sm'
                  }`}>
                    <p className={`text-sm whitespace-pre-wrap leading-relaxed ${
                      msg.role === 'user' ? 'text-primary-foreground' : 'text-foreground'
                    }`}>
                      {msg.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-xs">
                    {selectedAgent.avatar}
                  </AvatarFallback>
                </Avatar>
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border rounded-tl-sm">
                  <p className="text-sm text-muted-foreground">正在思考…</p>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-border bg-muted/10">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <Input
                  aria-label="输入消息"
                  placeholder={`向 ${selectedAgent.name} 提问...`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={sending}
                  className="pr-10 py-5 bg-background border-border"
                />
                <Button variant="ghost" size="icon" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
              <Button
                size="icon"
                aria-label="发送"
                className="h-10 w-10 rounded-lg shadow-sm"
                onClick={() => handleSend()}
                disabled={sending || !message.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {/* Quick Suggestions */}
            <div className="flex items-center gap-2 mt-3">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex gap-1.5 overflow-x-auto">
                {[
                  '查询订单状态',
                  '投诉处理',
                  '产品咨询',
                  '退款申请',
                ].map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-7 text-xs"
                    disabled={sending}
                    onClick={() => handleSend(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
