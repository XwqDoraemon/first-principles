# First Principles - 从 Express 迁移到 Cloudflare + Supabase 操作指南

## 迁移路径总览

```
当前架构: Express + SQLite → 目标架构: Cloudflare Pages + Supabase
   ↓                          ↓
VPS 服务器                 无服务器架构
```

## 步骤 1: 准备 Cloudflare 环境 (30 分钟)

### 1.1 创建 Cloudflare 账号
```bash
# 访问 https://dash.cloudflare.com/sign-up
# 使用邮箱注册账号
```

### 1.2 安装 Wrangler CLI
```bash
npm install -g wrangler

# 登录 Cloudflare
wrangler login
```

### 1.3 创建项目目录
```bash
cd /root/.openclaw/workspace-developer-xue/first-principles

# 创建 Cloudflare 配置文件
cat > wrangler.toml << 'EOF'
name = "first-principles"
compatibility_date = "2024-04-04"

[env.production]
vars = { ENVIRONMENT = "production" }
EOF
```

## 步骤 2: 配置 Astro 为静态站点 (1 小时)

### 2.1 更新 Astro 配置<tool_call>edit<arg_key>path</arg_key><arg_value>/root/.openclaw/workspace-developer-xue/first-principles/astro.config.mjs