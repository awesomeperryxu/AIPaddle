'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mockConversations } from '@/lib/mock-data';
import {
  Send,
  Paperclip,
  Mic,
  Bot,
  User,
  Sparkles,
  History,
  Plus,
  Zap,
  FileText,
  Image,
  ChevronRight
} from 'lucide-react';

export function AssistantView() {
  const [message, setMessage] = useState('');
  const [activeChat, setActiveChat] = useState(mockConversations[0]);

  const quickActions = [
    { icon: FileText, label: '总结文档', prompt: '帮我总结一下这份文档的要点' },
    { icon: Zap, label: '创建 Skill', prompt: '帮我创建一个新的 Skill' },
    { icon: Image, label: '分析图片', prompt: '帮我分析这张图片的内容' },
  ];

  return (
    <div className="flex h-full gap-6">
      {/* Chat History Sidebar */}
      <div className="w-72 space-y-4">
        <Button className="w-full gap-2">
          <Plus className="h-4 w-4" />
          新建对话
        </Button>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2">历史会话</p>
          {mockConversations.map((conv) => (
            <div
              key={conv.id}
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                activeChat?.id === conv.id
                  ? 'bg-primary/10 border border-primary/20'
                  : 'bg-card hover:bg-muted/50'
              }`}
              onClick={() => setActiveChat(conv)}
            >
              <div className="flex items-center gap-2 mb-1">
                <Bot className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground truncate">{conv.agentName}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {conv.messages[0]?.content}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{conv.timestamp}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-medium text-foreground">{activeChat.agentName}</h2>
                  <p className="text-xs text-muted-foreground">正在使用个人助理</p>
                </div>
              </div>
              <Button variant="ghost" size="icon">
                <History className="h-5 w-5" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto py-6 space-y-6">
              {activeChat.messages.map((msg, index) => (
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
                        : 'bg-card border border-border rounded-tl-sm'
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
            <div className="pt-4 border-t border-border space-y-3">
              {/* Quick Actions */}
              <div className="flex gap-2">
                {quickActions.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setMessage(action.prompt)}
                  >
                    <action.icon className="h-4 w-4" />
                    {action.label}
                  </Button>
                ))}
              </div>

              {/* Message Input */}
              <div className="flex items-end gap-3">
                <div className="flex-1 relative">
                  <Input
                    placeholder="输入你的问题..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="pr-24 py-6 bg-card border-border"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Mic className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                <Button size="icon" className="h-12 w-12 rounded-xl">
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">你好！我是你的 AI 助理</h2>
                <p className="text-muted-foreground mt-1">有什么我可以帮助你的吗？</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {quickActions.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    className="gap-2"
                    onClick={() => setMessage(action.prompt)}
                  >
                    <action.icon className="h-4 w-4" />
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* My Skills Panel */}
      <div className="w-72 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">我的 Skill</h3>
          <Button variant="ghost" size="sm">
            查看全部
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        <div className="space-y-2">
          {[
            { name: '周报生成器', desc: '自动生成周报摘要', calls: 45 },
            { name: '邮件回复助手', desc: '智能生成邮件回复', calls: 128 },
            { name: '会议纪要', desc: '自动提取会议要点', calls: 32 },
          ].map((skill) => (
            <Card key={skill.name} className="bg-card border-border">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{skill.name}</p>
                    <p className="text-xs text-muted-foreground">{skill.calls} 次使用</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button variant="outline" className="w-full gap-2">
          <Plus className="h-4 w-4" />
          创建新 Skill
        </Button>
      </div>
    </div>
  );
}
