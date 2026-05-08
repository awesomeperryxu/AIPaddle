'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { mockAgents, Agent, mockConversations } from '@/lib/mock-data';
import {
  Search,
  Bot,
  MessageSquare,
  Star,
  Clock,
  Send,
  Paperclip,
  User
} from 'lucide-react';

export function AgentsView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [message, setMessage] = useState('');

  const publishedAgents = mockAgents.filter(a => a.status === 'published');
  const filteredAgents = publishedAgents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-full gap-6">
      {/* Agent List */}
      <div className={`space-y-4 ${selectedAgent ? 'w-80' : 'flex-1'}`}>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">数字员工</h1>
          <p className="text-muted-foreground">选择一个 Agent 开始对话</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索 Agent..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>

        {/* Recent Used */}
        {!selectedAgent && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">最近使用</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {publishedAgents.slice(0, 3).map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border cursor-pointer hover:border-primary/50 transition-colors shrink-0"
                  onClick={() => setSelectedAgent(agent)}
                >
                  <span className="text-lg">{agent.avatar}</span>
                  <span className="text-sm text-foreground">{agent.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agent Grid */}
        <div className={`grid gap-4 ${selectedAgent ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {filteredAgents.map((agent) => (
            <Card
              key={agent.id}
              className={`bg-card border-border cursor-pointer transition-all hover:border-primary/50 ${
                selectedAgent?.id === agent.id ? 'border-primary ring-1 ring-primary' : ''
              }`}
              onClick={() => setSelectedAgent(agent)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-2xl shrink-0">
                    {agent.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground truncate">{agent.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{agent.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">{agent.department}</Badge>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {agent.calls.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      {selectedAgent && (
        <div className="flex-1 flex flex-col bg-card rounded-xl border border-border">
          {/* Chat Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-xl">
                {selectedAgent.avatar}
              </div>
              <div>
                <h2 className="font-medium text-foreground">{selectedAgent.name}</h2>
                <p className="text-xs text-muted-foreground">{selectedAgent.department}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Star className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon">
                <Clock className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Welcome Message */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="max-w-[70%]">
                <div className="p-4 rounded-2xl bg-muted/30 border border-border rounded-tl-sm">
                  <p className="text-sm text-foreground">
                    你好！我是{selectedAgent.name}。{selectedAgent.description}
                    <br /><br />
                    有什么可以帮助你的吗？
                  </p>
                </div>
              </div>
            </div>

            {/* Sample Conversation */}
            {mockConversations[0].messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  msg.role === 'user'
                    ? 'bg-primary/10'
                    : 'bg-gradient-to-br from-primary/20 to-accent/20'
                }`}>
                  {msg.role === 'user' ? (
                    <User className="h-4 w-4 text-primary" />
                  ) : (
                    <Bot className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className={`max-w-[70%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <div className={`p-4 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted/30 border border-border rounded-tl-sm'
                  }`}>
                    <p className={`text-sm whitespace-pre-wrap ${
                      msg.role === 'user' ? 'text-primary-foreground' : 'text-foreground'
                    }`}>
                      {msg.content}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{msg.timestamp}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-border">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <Input
                  placeholder={`向 ${selectedAgent.name} 提问...`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="pr-12 py-6 bg-muted/30 border-border"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
              <Button size="icon" className="h-12 w-12 rounded-xl">
                <Send className="h-5 w-5" />
              </Button>
            </div>

            {/* Quick Suggestions */}
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
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
                  className="shrink-0"
                  onClick={() => setMessage(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
