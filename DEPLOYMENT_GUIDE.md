# First Principles 部署指南

## 架构概述

```
前端: Cloudflare Pages (本地开发中)
后端: Supabase (PostgreSQL + Edge Functions)
AI服务: 本地 CrewAI (Python)
```

## 部署步骤

### 第一阶段：Supabase 后端部署

#### 1. 创建 Supabase 项目
1. 访问 [supabase.com](https://supabase.com) 并注册/登录
2. 点击 "New Project"
3. 填写项目信息：
   - **Name**: first-principles
   - **Database Password**: 生成强密码
   - **Region**: 选择离用户最近的区域
   - **Pricing Plan**: 从免费层开始

#### 2. 配置本地开发环境
```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录 Supabase
supabase login

# 进入项目目录
cd /root/.openclaw/workspace-developer-xue/first-principles/supabase

# 链接到项目 (获取 project-ref 从 Supabase 控制台)
supabase link --project-ref your-project-ref

# 启动本地开发环境
supabase start
```

#### 3. 部署数据库
```bash
# 推送数据库 schema
supabase db push

# 验证数据库
supabase db reset
```

#### 4. 部署 Edge Functions
```bash
# 部署聊天功能
supabase functions deploy chat --no-verify-jwt

# 部署 CrewAI 集成
supabase functions deploy crewai --no-verify-jwt

# 部署健康检查
supabase functions deploy health --no-verify-jwt
```

#### 5. 配置环境变量
```bash
# 设置环境变量
supabase secrets set SUPABASE_URL="https://your-project-ref.supabase.co"
supabase secrets set SUPABASE_ANON_KEY="your-anon-key"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
supabase secrets set OPENAI_API_KEY="sk-..."
supabase secrets set DEEPSEEK_API_KEY="sk-..."
supabase secrets set CREWAI_LOCAL_URL="http://localhost:8000"
```

### 第二阶段：CrewAI 本地服务部署

#### 1. 安装 Python 依赖
```bash
cd /root/.openclaw/workspace-developer-xue/first-principles/crewai_service

# 创建虚拟环境
python3 -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 或者使用 uv (更快)
uv pip install -r requirements.txt
```

#### 2. 配置环境变量
```bash
# 创建 .env 文件
cp .env.example .env

# 编辑 .env 文件，添加 API 密钥
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
```

#### 3. 启动 CrewAI 服务
```bash
# 启动服务
python -m src.first_principles_crew.main

# 或者使用 Docker
docker build -t first-principles-crewai .
docker run -p 8000:8000 first-principles-crewai
```

### 第三阶段：前端本地开发

#### 1. 更新前端配置
编辑 `server/public-placeholder/supabase-config.js`：
```javascript
// 更新生产环境配置
production: {
  supabaseUrl: 'https://your-project-ref.supabase.co',
  supabaseAnonKey: 'your-anon-key-here',
  apiBaseUrl: 'https://your-project-ref.supabase.co/functions/v1',
  realtimeEnabled: true,
}
```

#### 2. 启动本地开发服务器
```bash
cd /root/.openclaw/workspace-developer-xue/first-principles

# 启动 Express 服务器 (用于本地开发)
npm run dev

# 或者直接使用 Python 静态服务器
python3 -m http.server 4322 --directory server/public-placeholder
```

#### 3. 测试完整流程
1. 访问 `http://localhost:4322/chat-supabase.html`
2. 注册/登录用户
3. 发送测试消息
4. 验证 CrewAI 集成

### 第四阶段：前端部署到 Cloudflare Pages

#### 1. 准备前端构建
```bash
# 构建前端 (如果使用构建工具)
npm run build

# 输出目录: dist/ 或 build/
```

#### 2. 部署到 Cloudflare Pages
1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 "Workers & Pages"
3. 点击 "Create application" → "Pages"
4. 选择 "Direct upload"
5. 上传构建文件或连接 Git 仓库

#### 3. 配置环境变量
在 Cloudflare Pages 设置中添加：
- `SUPABASE_URL`: https://your-project-ref.supabase.co
- `SUPABASE_ANON_KEY`: your-anon-key
- `API_BASE_URL`: https://your-project-ref.supabase.co/functions/v1

#### 4. 配置自定义域名 (可选)
1. 在 Pages 设置中添加自定义域名
2. 按照指引配置 DNS 记录
3. 启用 HTTPS

## 环境配置

### 开发环境 (.env.development)
```env
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
CREWAI_LOCAL_URL=http://localhost:8000
ENVIRONMENT=development
```

### 生产环境 (.env.production)
```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-production-anon-key
CREWAI_LOCAL_URL=http://localhost:8000  # 或云部署地址
ENVIRONMENT=production
```

## 监控和维护

### 健康检查
```bash
# 检查 Supabase 健康
curl https://your-project-ref.supabase.co/functions/v1/health

# 检查 CrewAI 服务
curl http://localhost:8000/api/crewai/health
```

### 日志查看
```bash
# Supabase 日志
supabase logs

# Edge Functions 日志
supabase functions logs chat
supabase functions logs crewai

# 本地 CrewAI 日志
tail -f crewai_service/logs/app.log
```

### 备份和恢复
```bash
# 数据库备份
supabase db dump --local

# 恢复备份
supabase db reset
```

## 故障排除

### 常见问题

#### 1. Supabase 连接失败
```bash
# 检查网络连接
ping your-project-ref.supabase.co

# 检查 API 密钥
curl -H "apikey: YOUR_ANON_KEY" https://your-project-ref.supabase.co/rest/v1/
```

#### 2. Edge Functions 部署失败
```bash
# 查看详细错误
supabase functions deploy chat --verbose

# 本地测试函数
supabase functions serve chat
```

#### 3. CrewAI 服务无法启动
```bash
# 检查 Python 依赖
python -c "import crewai; print(crewai.__version__)"

# 检查端口占用
netstat -tulpn | grep :8000

# 查看错误日志
tail -f crewai_service/logs/error.log
```

#### 4. 前端 API 调用失败
```javascript
// 检查浏览器控制台
console.log(window.FirstPrinciples.config);

// 测试 API 连接
fetch('https://your-project-ref.supabase.co/functions/v1/health')
  .then(res => res.json())
  .then(console.log);
```

### 性能优化

#### 数据库优化
```sql
-- 添加索引
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_thinking_sessions_user_status ON thinking_sessions(user_id, status);

-- 定期清理旧数据
DELETE FROM messages WHERE created_at < NOW() - INTERVAL '90 days';
```

#### 前端优化
```javascript
// 实现消息分页
const loadMoreMessages = async (conversationId, offset = 0) => {
  return fetch(`${API_ENDPOINTS.messages}?conversation_id=eq.${conversationId}&order=created_at.desc&limit=20&offset=${offset}`);
};

// 实现虚拟滚动
// 使用 Intersection Observer 延迟加载
```

#### CrewAI 优化
```python
# 实现结果缓存
from functools import lru_cache

@lru_cache(maxsize=100)
def cached_crewai_analysis(problem_statement):
    return crew.run(inputs={"problem": problem_statement})
```

## 安全考虑

### API 安全
1. **启用 Row Level Security (RLS)**: 确保用户只能访问自己的数据
2. **使用环境变量**: 不要硬编码 API 密钥
3. **实现速率限制**: 防止 API 滥用
4. **启用 CORS**: 只允许信任的域名

### 数据安全
1. **数据库加密**: Supabase 自动加密静态数据
2. **传输加密**: 始终使用 HTTPS
3. **定期备份**: 自动备份数据库
4. **访问日志**: 记录所有 API 调用

### 用户认证
1. **使用 Supabase Auth**: 内置的安全认证系统
2. **会话管理**: 合理的会话超时设置
3. **密码策略**: 强密码要求
4. **双因素认证**: 可选的安全增强

## 扩展和升级

### 水平扩展
1. **数据库**: Supabase 自动扩展
2. **Edge Functions**: 无服务器自动扩展
3. **CrewAI 服务**: 部署多个实例 + 负载均衡

### 功能扩展
1. **添加新的 AI 模型**: 在 CrewAI 配置中添加
2. **集成外部工具**: 添加新的 CrewAI 工具
3. **自定义工作流**: 修改智能体任务流程

### 监控升级
1. **添加 APM**: Datadog/New Relic
2. **错误跟踪**: Sentry
3. **用户分析**: PostHog/Mixpanel

## 成本估算

### 月度成本 (预估)
| 服务 | 免费层 | 增长阶段 (1000用户) | 规模阶段 (10000用户) |
|------|--------|---------------------|----------------------|
| Supabase | $0 | $25 | $100+ |
| Cloudflare Pages | $0 | $0 | $20 |
| AI API (OpenAI) | $10 | $50 | $500 |
| CrewAI 托管 | $0 (本地) | $20 (Railway) | $100 (K8s) |
| **总计** | **$10** | **$95** | **$720** |

### 成本优化建议
1. **使用缓存**: 减少重复的 AI 调用
2. **批处理请求**: 合并相似的分析
3. **模型选择**: 根据场景选择合适模型
4. **监控使用量**: 设置预算告警

## 支持联系方式

### 技术问题
- **GitHub Issues**: [项目仓库](https://github.com/your-org/first-principles)
- **Discord**: 开发社区频道
- **Email**: support@firstprinciples.ai

### 紧急问题
- **生产事故**: 页面显示紧急联系方式
- **安全漏洞**: security@firstprinciples.ai
- **数据恢复**: 备份恢复流程文档

---

**部署状态检查表**
- [ ] Supabase 项目创建
- [ ] 数据库部署
- [ ] Edge Functions 部署
- [ ] 环境变量配置
- [ ] CrewAI 本地服务运行
- [ ] 前端本地测试通过
- [ ] Cloudflare Pages 部署
- [ ] 自定义域名配置
- [ ] 监控设置
- [ ] 备份策略实施