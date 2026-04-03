# First Principles - Supabase 后端

## 项目结构

```
supabase/
├── migrations/              # 数据库迁移文件
├── functions/              # Edge Functions
├── config.toml            # Supabase CLI 配置
└── seed.sql              # 初始数据
```

## 数据库 Schema 设计

### 核心表
1. **users** - 用户信息
2. **conversations** - 对话会话
3. **messages** - 消息记录
4. **thinking_sessions** - CrewAI 思考会话
5. **mindmaps** - 思维导图

## 部署步骤

### 1. 安装 Supabase CLI
```bash
npm install -g supabase
```

### 2. 登录 Supabase
```bash
supabase login
```

### 3. 链接项目
```bash
supabase link --project-ref <project-ref>
```

### 4. 推送数据库
```bash
supabase db push
```

### 5. 部署 Edge Functions
```bash
supabase functions deploy <function-name>
```

## 环境变量

需要设置以下环境变量：
- `SUPABASE_URL`: Supabase 项目 URL
- `SUPABASE_ANON_KEY`: 匿名访问密钥
- `SUPABASE_SERVICE_ROLE_KEY`: 服务角色密钥
- `OPENAI_API_KEY`: OpenAI API 密钥
- `DEEPSEEK_API_KEY`: DeepSeek API 密钥

## API 端点

### REST API (自动生成)
- `POST /rest/v1/conversations` - 创建对话
- `GET /rest/v1/conversations` - 获取对话列表
- `GET /rest/v1/messages` - 获取消息

### Edge Functions
- `POST /functions/v1/chat` - 处理聊天请求
- `POST /functions/v1/crewai` - CrewAI 集成
- `GET /functions/v1/health` - 健康检查

## 本地开发

```bash
# 启动本地 Supabase
supabase start

# 查看状态
supabase status

# 停止服务
supabase stop
```