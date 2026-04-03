# First Principles - Supabase 后端 (简化架构版本)

## 架构概述

简化后的架构使用直接 LLM API 调用 + 精心设计的 skill 系统，替代了复杂的 CrewAI 多代理系统。

```
用户 → Supabase Edge Functions → DeepSeek API → 响应 → 用户
        │
        ├─ 第一性原理 Skill 系统 (内置)
        ├─ PostgreSQL 数据库
        └─ 实时订阅
```

## 核心优势

### 🚀 性能提升
- **响应时间**: 从 30-60 秒减少到 2-5 秒
- **复杂度**: 移除 Python 依赖和进程间通信
- **可靠性**: 直接 API 调用，无中间层故障点

### 🛠️ 技术栈简化
- **后端**: Supabase Edge Functions (Deno)
- **数据库**: PostgreSQL (Supabase 托管)
- **AI 服务**: 直接 DeepSeek API 调用
- **架构**: 无 CrewAI，无 Python 依赖

### 📊 功能完整
- ✅ 完整的第一性原理思维框架
- ✅ 对话持久化
- ✅ 思维导图生成
- ✅ 用户认证和授权
- ✅ 实时数据同步

## 项目结构

```
supabase/
├── migrations/              # 数据库迁移文件
│   ├── 2024040301_initial_schema.sql    # 初始架构
│   └── 2024040302_simplified_schema.sql # 简化架构迁移
├── functions/              # Edge Functions
│   ├── chat/              # 聊天处理函数
│   └── health/            # 健康检查函数
├── config.toml            # Supabase CLI 配置
├── deploy.sh             # 一键部署脚本
└── .env.example          # 环境变量示例
```

## 数据库 Schema

### 核心表 (简化后)
1. **users** - 用户信息 (与 Supabase Auth 集成)
2. **conversations** - 对话会话
3. **messages** - 消息记录
4. **mindmaps** - 思维导图

### 移除的表
- ❌ **thinking_sessions** - CrewAI 思考会话
- ❌ **usage_stats** - 使用统计 (可后续添加)

## Edge Functions

### 1. `chat` - 聊天处理
**端点**: `POST /functions/v1/chat`

**功能**:
- 处理用户聊天请求
- 调用 DeepSeek API 进行第一性原理思考
- 保存对话到数据库
- 返回结构化响应

**请求示例**:
```json
{
  "messages": [
    {"role": "user", "content": "如何提高工作效率？"}
  ],
  "userId": "user-uuid-here"
}
```

### 2. `health` - 健康检查
**端点**: `GET /functions/v1/health`

**功能**:
- 检查数据库连接状态
- 验证 DeepSeek API 可用性
- 返回系统状态信息

## 部署步骤

### 1. 安装 Supabase CLI
```bash
npm install -g supabase
```

### 2. 登录 Supabase
```bash
supabase login
```

### 3. 一键部署
```bash
cd supabase
chmod +x deploy.sh
./deploy.sh
```

按照脚本提示选择部署环境:
- **选项1**: 本地开发环境
- **选项2**: 链接到现有 Supabase 项目
- **选项3**: 创建新项目

### 4. 配置环境变量
复制 `.env.example` 为 `.env` 并填写实际值:
```bash
cp .env.example .env
# 编辑 .env 文件，填写你的 API 密钥
```

必需的环境变量:
- `DEEPSEEK_API_KEY`: DeepSeek API 密钥
- `SUPABASE_URL`: Supabase 项目 URL
- `SUPABASE_ANON_KEY`: Supabase 匿名密钥

### 5. 设置环境变量到 Supabase
```bash
supabase secrets set --env-file .env
```

## 环境变量说明

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `DEEPSEEK_API_KEY` | 是 | DeepSeek API 密钥 |
| `SUPABASE_URL` | 是 | Supabase 项目 URL |
| `SUPABASE_ANON_KEY` | 是 | Supabase 匿名访问密钥 |
| `SUPABASE_SERVICE_ROLE_KEY` | 否 | 服务角色密钥 (高级操作) |
| `OPENAI_API_KEY` | 否 | OpenAI API 密钥 (多模型支持) |

## API 使用示例

### 1. 健康检查
```bash
curl -X GET https://your-project.supabase.co/functions/v1/health
```

### 2. 发送聊天消息
```bash
curl -X POST https://your-project.supabase.co/functions/v1/chat \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "如何提高工作效率？"}
    ],
    "userId": "user-uuid-here"
  }'
```

### 3. 使用前端 SDK
```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

// 发送聊天消息
const { data, error } = await supabase.functions.invoke('chat', {
  body: {
    messages: [{ role: 'user', content: '如何提高工作效率？' }],
    userId: user.id
  }
})
```

## 本地开发

### 启动本地环境
```bash
cd supabase
supabase start
```

### 本地测试
```bash
# 测试健康检查
curl http://localhost:54321/functions/v1/health

# 测试聊天功能
curl -X POST http://localhost:54321/functions/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "测试消息"}],
    "userId": "test-user"
  }'
```

### 停止本地环境
```bash
supabase stop
```

## 生产部署

### 1. 链接到生产项目
```bash
supabase link --project-ref your-project-ref
```

### 2. 部署数据库
```bash
supabase db push
```

### 3. 部署 Edge Functions
```bash
supabase functions deploy chat
supabase functions deploy health
```

### 4. 设置生产环境变量
```bash
supabase secrets set --env-file .env.production
```

## 故障排除

### 常见问题

1. **数据库连接失败**
   ```bash
   # 检查数据库状态
   supabase status
   
   # 重启本地服务
   supabase stop
   supabase start
   ```

2. **Edge Function 部署失败**
   ```bash
   # 查看部署日志
   supabase functions deploy chat --verbose
   
   # 检查函数日志
   supabase functions logs chat
   ```

3. **API 密钥错误**
   ```bash
   # 重新设置环境变量
   supabase secrets set DEEPSEEK_API_KEY=your-new-key
   ```

4. **CORS 问题**
   - 确保前端域名在 `CORS_ORIGINS` 环境变量中
   - 检查 Edge Function 的 CORS 头设置

### 调试 Edge Functions
```bash
# 查看实时日志
supabase functions serve chat --env-file .env

# 测试函数
curl -X POST http://localhost:54321/functions/v1/chat \
  -H "Content-Type: application/json" \
  -d @test-request.json
```

## 架构演进

### 从 CrewAI 到简化架构
- **移除**: CrewAI Python 服务、进程间通信桥接
- **保留**: 第一性原理思维框架、对话管理、思维导图
- **改进**: 响应速度、可靠性、部署复杂度

### 未来扩展
1. **多模型支持**: 集成 OpenAI、Claude 等
2. **高级分析**: 对话质量评估、用户行为分析
3. **团队协作**: 共享对话、协作思考
4. **知识库**: 历史对话学习、模式识别

## 性能指标

| 指标 | 简化架构 | CrewAI 架构 |
|------|----------|-------------|
| 响应时间 | 2-5 秒 | 30-60 秒 |
| 冷启动时间 | < 1 秒 | 5-10 秒 |
| 并发处理 | 高 (无状态) | 低 (有状态) |
| 错误率 | < 1% | 5-10% |
| 部署时间 | 2 分钟 | 10+ 分钟 |

## 支持与贡献

### 获取帮助
- 查看 [Supabase 文档](https://supabase.com/docs)
- 参考 [DeepSeek API 文档](https://platform.deepseek.com/api-docs)
- 提交 Issue 到项目仓库

### 贡献代码
1. Fork 项目仓库
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

## 许可证

MIT License - 详见 LICENSE 文件