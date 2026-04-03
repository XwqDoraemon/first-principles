# First Principles - Supabase 后端部署指南

## 概述

本文档指导您将 First Principles 应用部署到 Supabase 后端。我们已从 CrewAI 架构迁移到简化架构，使用直接 LLM API 调用 + skill 系统。

## 架构对比

### 旧架构 (已移除)
```
用户 → Express 服务器 → CrewAI Python 服务 → 多代理 → 响应
```

### 新架构 (Supabase)
```
用户 → Express 代理服务器 → Supabase Edge Functions → DeepSeek API → 响应
        │
        └─ Supabase PostgreSQL 数据库
```

## 部署步骤

### 步骤 1: 准备 Supabase 项目

#### 选项 A: 创建新 Supabase 项目
1. 访问 [Supabase 控制台](https://app.supabase.com)
2. 点击 "New Project"
3. 填写项目名称和数据库密码
4. 选择区域 (建议选择离用户近的区域)
5. 等待项目创建完成

#### 选项 B: 使用现有项目
1. 获取项目引用 ID (project-ref)
2. 获取以下密钥:
   - `SUPABASE_URL`: 项目 URL
   - `SUPABASE_ANON_KEY`: 匿名访问密钥
   - `SUPABASE_SERVICE_ROLE_KEY`: 服务角色密钥

### 步骤 2: 配置环境变量

创建 `.env` 文件:
```bash
cd /root/.openclaw/workspace-developer-xue/first-principles/supabase
cp .env.example .env
```

编辑 `.env` 文件:
```env
# Supabase 配置
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# DeepSeek API 配置
DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here

# 应用配置
APP_NAME=First Principles
LOG_LEVEL=info
```

### 步骤 3: 部署数据库和 Edge Functions

运行部署脚本:
```bash
cd /root/.openclaw/workspace-developer-xue/first-principles/supabase
chmod +x deploy.sh
./deploy.sh
```

按照脚本提示操作:
1. 选择部署环境 (推荐选项 2: 链接到现有项目)
2. 输入项目引用 ID
3. 等待部署完成

### 步骤 4: 验证部署

#### 测试健康检查:
```bash
curl https://your-project.supabase.co/functions/v1/health
```

预期响应:
```json
{
  "status": "healthy",
  "timestamp": "2026-04-03T13:30:00.000Z",
  "services": {
    "database": { "status": "healthy" },
    "deepseek_api": { "status": "healthy", "configured": true }
  }
}
```

#### 测试聊天功能:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-anon-key" \
  -d '{
    "messages": [
      {"role": "user", "content": "如何提高工作效率？"}
    ],
    "userId": "test-user"
  }'
```

### 步骤 5: 启动前端服务器

#### 配置前端环境变量:
```bash
cd /root/.openclaw/workspace-developer-xue/first-principles
cat > .env << EOF
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here
PORT=4322
HOST=0.0.0.0
EOF
```

#### 启动 Supabase 前端服务器:
```bash
cd /root/.openclaw/workspace-developer-xue/first-principles
node server/supabase-server.cjs
```

### 步骤 6: 访问应用

打开浏览器访问:
- **本地**: http://localhost:4322
- **公网**: http://43.153.79.127:4322

## 环境变量说明

### 必需变量
| 变量名 | 说明 | 获取方式 |
|--------|------|----------|
| `SUPABASE_URL` | Supabase 项目 URL | Supabase 项目设置 → API → URL |
| `SUPABASE_ANON_KEY` | 匿名访问密钥 | Supabase 项目设置 → API → anon public |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | [DeepSeek 控制台](https://platform.deepseek.com) |

### 可选变量
| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | 4322 | 前端服务器端口 |
| `HOST` | 0.0.0.0 | 服务器监听地址 |
| `LOG_LEVEL` | info | 日志级别 (debug, info, warn, error) |

## 数据库 Schema

### 核心表
1. **users** - 用户信息 (与 Supabase Auth 集成)
2. **conversations** - 对话会话
3. **messages** - 消息记录
4. **mindmaps** - 思维导图

### 表结构详情

#### conversations 表
```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Session',
    status TEXT NOT NULL DEFAULT 'active',
    message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### messages 表
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Edge Functions 详情

### 1. chat 函数
- **路径**: `/functions/v1/chat`
- **方法**: POST
- **功能**: 处理聊天请求，调用 DeepSeek API
- **认证**: 需要有效的 JWT 令牌

### 2. health 函数
- **路径**: `/functions/v1/health`
- **方法**: GET
- **功能**: 系统健康检查
- **认证**: 无需认证

## 故障排除

### 常见问题

#### 1. 数据库连接失败
```bash
# 检查数据库状态
supabase status

# 查看数据库日志
supabase logs db
```

#### 2. Edge Function 部署失败
```bash
# 查看部署详情
supabase functions deploy chat --verbose

# 查看函数日志
supabase functions logs chat
```

#### 3. API 密钥错误
```bash
# 重新设置环境变量
supabase secrets set DEEPSEEK_API_KEY=your-new-key

# 验证密钥
curl -H "Authorization: Bearer your-key" https://api.deepseek.com/v1/models
```

#### 4. CORS 问题
确保前端域名已添加到 Supabase CORS 配置:
1. 进入 Supabase 控制台
2. 选择项目 → 设置 → API
3. 在 "Site URL" 和 "Additional URLs" 中添加前端域名

### 日志查看

#### 查看 Edge Function 日志:
```bash
supabase functions logs chat --follow
```

#### 查看数据库日志:
```bash
supabase logs db --follow
```

#### 查看前端服务器日志:
前端服务器控制台会显示详细日志。

## 性能优化

### 1. 数据库索引优化
已为以下字段创建索引:
- `conversations(user_id, status, created_at)`
- `messages(conversation_id, created_at)`
- `mindmaps(conversation_id)`

### 2. Edge Function 优化
- 使用连接池管理数据库连接
- 实现请求缓存
- 优化错误处理和重试机制

### 3. API 调用优化
- 使用流式响应减少延迟
- 实现请求批处理
- 添加速率限制

## 监控和维护

### 1. 监控指标
- **响应时间**: Edge Function 执行时间
- **错误率**: API 调用失败率
- **使用量**: 对话和消息数量
- **数据库性能**: 查询响应时间

### 2. 定期维护
1. **数据库备份**: 定期导出数据库备份
2. **日志清理**: 清理旧日志文件
3. **依赖更新**: 定期更新 npm 包
4. **安全审计**: 检查安全配置

### 3. 报警设置
建议设置以下报警:
- 数据库连接失败
- Edge Function 错误率 > 5%
- 响应时间 > 10 秒
- API 密钥即将过期

## 扩展和定制

### 1. 添加新功能
#### 添加新的 Edge Function:
```bash
# 创建新函数
supabase functions new my-function

# 部署函数
supabase functions deploy my-function
```

#### 添加数据库表:
1. 创建迁移文件: `supabase/migrations/YYYYMMDD_description.sql`
2. 运行迁移: `supabase db push`

### 2. 集成其他服务
#### 集成 OpenAI:
1. 添加 `OPENAI_API_KEY` 环境变量
2. 修改 chat 函数支持多模型
3. 添加模型选择参数

#### 集成分析服务:
1. 添加 PostHog 或 Mixpanel
2. 在 Edge Functions 中添加跟踪代码
3. 配置用户行为分析

### 3. 国际化支持
1. 添加语言环境参数
2. 创建多语言 skill 文件
3. 根据用户语言选择响应语言

## 安全建议

### 1. 密钥管理
- 使用环境变量存储敏感信息
- 定期轮换 API 密钥
- 使用不同的密钥用于不同环境

### 2. 访问控制
- 启用 Supabase RLS (行级安全)
- 实现基于角色的访问控制
- 添加请求速率限制

### 3. 数据保护
- 加密敏感数据
- 定期备份数据库
- 实现数据保留策略

### 4. 网络安全
- 启用 HTTPS
- 配置 CORS 策略
- 使用 Web Application Firewall

## 成本估算

### Supabase 成本
| 资源 | 免费层 | 专业层 ($25/月) |
|------|--------|----------------|
| 数据库 | 500MB | 8GB |
| 带宽 | 5GB | 250GB |
| Edge Functions | 500MB | 100GB |
| 认证用户 | 50,000 | 无限 |

### DeepSeek API 成本
- 输入: $0.14/百万 tokens
- 输出: $0.28/百万 tokens
- 预计每月成本: $5-50 (取决于使用量)

### 总成本估算
- **小规模使用**: $0-10/月 (免费层 + API 成本)
- **中等规模**: $30-80/月 (专业层 + API 成本)
- **大规模**: $100+/月 (企业方案)

## 支持资源

### 官方文档
- [Supabase 文档](https://supabase.com/docs)
- [DeepSeek API 文档](https://platform.deepseek.com/api-docs)
- [First Principles Skill 文档](./src/data/skill.md)

### 社区支持
- [Supabase Discord](https://discord.supabase.com)
- [GitHub Issues](https://github.com/your-repo/issues)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/supabase)

### 专业服务
如需专业部署支持，请联系:
- 邮箱: support@firstprinciples.ai
- 网站: https://firstprinciples.ai

## 更新日志

### v1.0.0 (2026-04-03)
- ✅ 从 CrewAI 迁移到简化架构
- ✅ 集成 Supabase 后端
- ✅ 部署 Edge Functions
- ✅ 配置数据库 Schema
- ✅ 创建部署脚本和文档

### 未来计划
- [ ] 多模型支持 (OpenAI, Claude)
- [ ] 团队协作功能
- [ ] 高级分析面板
- [ ] 移动应用

---

**部署完成!** 您的 First Principles 应用现在运行在 Supabase 后端上，具有更好的性能、可靠性和可扩展性。