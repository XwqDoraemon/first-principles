# First Principles - 部署方案说明

## 最终架构决策 (2026-04-07)

**Boss 确认的部署方案：**

```
✅ Astro 前端 (本地开发模式，端口 4322)
✅ Supabase Edge Functions (云端后端)
✅ Supabase PostgreSQL (云端数据库)
✅ DeepSeek API (AI 服务)
❌ Express 服务器 (已停止，保留用于本地开发)
```

## 架构优势

### 与传统 Express 服务器对比

| 方面 | Express (旧) | Supabase (新) | 优势 |
|------|--------------|---------------|------|
| **维护成本** | 高 (手动管理) | 低 (托管服务) | ✅ 无需维护 |
| **扩展性** | 低 (单机) | 高 (自动扩展) | ✅ 弹性伸缩 |
| **可靠性** | 中 (单点故障) | 高 (99.99% SLA) | ✅ 高可用 |
| **全球部署** | 无 | 有 (边缘网络) | ✅ 低延迟 |
| **语言检测** | ❌ | ✅ 已实现 | ✅ 智能回复 |
| **服务器成本** | $XX/月 | $0-25/月 | ✅ 成本优化 |

## 部署状态

### 前端 (本地)
- **框架**: Astro
- **状态**: 本地开发模式
- **端口**: 4322 (固定)
- **访问**: http://localhost:4322
- **启动**: `npm run dev`

### 后端 (Supabase 云端)
- **Edge Functions**: ✅ 已部署
- **数据库**: ✅ 已创建
- **认证**: ✅ 已配置
- **语言检测**: ✅ 已实现

## 已清理的旧方案文件

以下文件已被删除，防止混淆：

~~CLOUDFLARE_SUPABASE_ARCHITECTURE.md~~ ❌
~~CREWAI_INTEGRATION.md~~ ❌
~~DEPLOYMENT_CHECKLIST.md~~ ❌
~~DEPLOYMENT_GUIDE.md~~ ❌
~~LANGUAGE_DETECTION_UPDATE.md~~ ❌
~~MIGRATION_GUIDE.md~~ ❌
~~migration-step-*.md~~ ❌
~~MIGRATION_SUMMARY.md~~ ❌
~~NEXTJS_MIGRATION_GUIDE.md~~ ❌
~~SIMPLIFIED_ARCHITECTURE.md~~ ❌
~~SUPABASE_DEPLOYMENT.md~~ ❌

**保留的核心文件：**
- ✅ FINAL_ARCHITECTURE.md (最终架构文档)
- ✅ FIRST-PRINCIPLES-MVP.md (产品需求)
- ✅ README.md (项目说明)
- ✅ DEPLOYMENT.md (本文件)

## 环境配置

### .env 文件 (固定端口)
```bash
# Supabase 配置
SUPABASE_URL=https://bmstklfbnyevuyxidmhv.supabase.co
SUPABASE_ANON_KEY=sb_publishable_wnQx8LZ7qUgVAsVOaEnuVQ_Ede5tM3w

# DeepSeek API 配置
DEEPSEEK_API_KEY=sk-5b7dacf1cc7f4066a0a0d7bb8f082c5b

# 服务器配置 (固定端口，防止每次更换)
PORT=4322
HOST=0.0.0.0
```

### server/index.cjs (固定端口逻辑)
```javascript
// 固定端口配置 - 防止每次启动更换端口
const PORT = 4322;
const HOST = process.env.HOST || '0.0.0.0';

// 覆盖环境变量以确保端口固定
process.env.PORT = PORT;

app.listen(PORT, HOST, () => {
  console.log(`First Principles Server running on http://${HOST}:${PORT}`);
  console.log(`  Architecture: Astro frontend + Supabase backend`);
});
```

## 启动流程

### 1. 本地开发
```bash
cd /root/.openclaw/workspace-developer-xue/first-principles
npm run dev
```

**输出：**
```
First Principles Server running on http://0.0.0.0:4322
  Local:  http://localhost:4322
  Public: http://43.153.79.127:4322
  API:    http://0.0.0.0:4322/api/chat
  DB:     SQLite at /tmp/fp-db.sqlite3
  Architecture: Astro frontend + Supabase backend
```

### 2. 访问应用
- 聊天界面: http://localhost:4322/chat-supabase.html
- 历史记录: http://localhost:4322/history
- 思维导图: http://localhost:4322/mindmap/:id
- 关于页面: http://localhost:4322/about

## API 调用示例

### 聊天功能 (Supabase Edge Function)
```javascript
const response = await fetch(
  'https://bmstklfbnyevuyxidmhv.supabase.co/functions/v1/chat',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sb_publishable_wnQx8LZ7qUgVAsVOaEnuVQ_Ede5tM3w'
    },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: '你好，我有一个问题' }
      ],
      userId: 'user-123'
    })
  }
);
```

### 健康检查
```javascript
const response = await fetch(
  'https://bmstklfbnyevuyxidmhv.supabase.co/functions/v1/health'
);
```

## 监控和维护

### 健康检查
```bash
# 检查本地服务器
curl http://localhost:4322/api/health

# 检查 Supabase Edge Functions
curl https://bmstklfbnyevuyxidmhv.supabase.co/functions/v1/health
```

### 日志查看
```bash
# 本地服务器日志 (控制台输出)
npm run dev

# Supabase 日志
# 访问: https://app.supabase.com/functions/logs
```

### 数据库备份
```bash
# Supabase 自动备份
# 手动备份: https://app.supabase.com/database/backups
```

## 故障排除

### 端口被占用
```bash
# 查看端口占用
lsof -i :4322

# 杀死进程
kill -9 <PID>

# 重新启动
npm run dev
```

### API 调用失败
1. 检查网络连接
2. 验证 `.env` 配置
3. 查看浏览器控制台错误
4. 检查 Supabase 项目状态

### 数据库问题
```bash
# 重置本地数据库
rm /tmp/fp-db.sqlite3
npm run dev
```

## 未来部署计划

### 短期 (1-2周)
- ✅ 本地开发环境稳定
- ✅ 语言检测功能完善
- ⏳ 错误处理优化

### 中期 (1-2月)
- ⏳ 前端部署到 Cloudflare Pages
- ⏳ 自定义域名配置
- ⏳ CDN 加速

### 长期 (3-6月)
- ⏳ 用户认证系统
- ⏳ 多模型支持 (OpenAI, Claude)
- ⏳ 团队协作功能

## 技术栈总结

| 组件 | 技术 | 状态 | 说明 |
|------|------|------|------|
| **前端框架** | Astro | ✅ 本地 | 端口固定 4322 |
| **后端** | Supabase Edge Functions | ✅ 云端 | Deno 运行时 |
| **数据库** | Supabase PostgreSQL | ✅ 云端 | 托管服务 |
| **认证** | Supabase Auth | ✅ 已配置 | JWT 认证 |
| **AI 服务** | DeepSeek API | ✅ 已集成 | 语言检测 |
| **本地服务器** | Express | 🔄 保留 | 仅用于开发 |

## 成本估算

### 月度成本 (预估)
| 服务 | 免费层 | 增长阶段 | 规模阶段 |
|------|--------|----------|----------|
| Astro (本地) | $0 | $0 | $0 |
| Supabase | $0 | $25 | $100+ |
| DeepSeek API | $0-10 | $10-50 | $50-500 |
| **总计** | **$0-10** | **$35-75** | **$150-600** |

## 支持资源

- **Supabase 文档**: https://supabase.com/docs
- **Astro 文档**: https://docs.astro.build
- **DeepSeek API**: https://platform.deepseek.com
- **项目仓库**: 本地路径

---

**最后更新**: 2026-04-07  
**架构版本**: 2.0.0  
**状态**: ✅ 稳定运行  
**端口**: 4322 (固定)
