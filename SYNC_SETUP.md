# 📋 文档自动同步设置说明

## ✅ 已完成的配置

### 1. 仓库克隆
- **位置**: `~/github/v0-ai-llmops-prototype`
- **远程仓库**: https://github.com/HELLOPERRYXU/v0-ai-llmops-prototype.git
- **当前分支**: main

### 2. 同步脚本
- **脚本位置**: `~/github/v0-ai-llmops-prototype/sync-docs.sh`
- **功能**: 自动同步 docs 文件夹到 GitHub
- **日志文件**: `~/github/v0-ai-llmops-prototype/sync-docs.log`

### 3. 定时任务
- **配置文件**: `~/Library/LaunchAgents/com.perryxu.v0-docs-sync.plist`
- **执行时间**: 每天早上 8:00
- **状态**: ✅ 已加载并运行

---

## 🚀 使用方法

### 手动同步
```bash
cd ~/github/v0-ai-llmops-prototype
./sync-docs.sh
```

### 查看同步日志
```bash
tail -f ~/github/v0-ai-llmops-prototype/sync-docs.log
```

### 查看定时任务状态
```bash
launchctl list | grep v0-docs-sync
```

---

## 🔧 管理定时任务

### 停止定时任务
```bash
launchctl unload ~/Library/LaunchAgents/com.perryxu.v0-docs-sync.plist
```

### 重新启动定时任务
```bash
launchctl load ~/Library/LaunchAgents/com.perryxu.v0-docs-sync.plist
```

### 修改执行时间
编辑配置文件：
```bash
nano ~/Library/LaunchAgents/com.perryxu.v0-docs-sync.plist
```

修改 `Hour` 和 `Minute` 值，然后重新加载：
```bash
launchctl unload ~/Library/LaunchAgents/com.perryxu.v0-docs-sync.plist
launchctl load ~/Library/LaunchAgents/com.perryxu.v0-docs-sync.plist
```

---

## 📝 工作流程

1. **每天早上 8:00**，系统自动执行 `sync-docs.sh`
2. 脚本会：
   - 拉取最新代码 (`git pull`)
   - 检查 docs 文件夹的变更
   - 如果有变更，自动提交并推送到 GitHub
   - 记录日志到 `sync-docs.log`

---

## ⚠️ 注意事项

1. **确保 Git 认证已配置**
   - 如果使用 HTTPS，需要配置 credential helper
   - 如果使用 SSH，需要配置 SSH key

2. **避免冲突**
   - 建议只在本地修改 docs 文件夹
   - 如果在 GitHub 网页端修改，先手动 pull

3. **日志管理**
   - 日志文件会持续增长
   - 建议定期清理或使用 logrotate

---

## 🎯 测试

立即测试同步：
```bash
cd ~/github/v0-ai-llmops-prototype
echo "测试文件" > docs/test.txt
./sync-docs.sh
```

检查 GitHub 仓库是否已更新。

---

**设置完成时间**: 2026-05-07  
**配置状态**: ✅ 正常运行
