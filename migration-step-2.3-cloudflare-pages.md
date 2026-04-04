# 迁移步骤 2.3: 部署到 Cloudflare Pages

## 目标
将构建好的静态站点部署到 Cloudflare Pages，实现全球 CDN 加速。

## 前置条件

1. ✅ Astro 配置已更新为静态模式
2. ✅ 前端 API 调用已更新
3. ✅ 本地构建测试通过
4. ✅ Cloudflare CLI 已安装 (`wrangler`)

## 步骤 3.1: 准备构建

```bash
cd /root/.openclaw/workspace-developer-xue/first-principles

# 清理旧的构建
rm -rf dist/

# 构建静态站点
npm run build

# 验证构建输出
ls -la dist/
```

预期输出:
```
drwxr-xr-x  10 root root  4096 Apr  4 21:00 .
drwxr-xr-x  11 root root  4096 Apr  4 21:00 ..
drwxr-xr-x   2 root root  4096 Apr  4 21:00 _astro
drwxr-xr-x   3 root root  4096 Apr  4 21:00 chat
drwxr-xr-x   2 root root  4096 Apr  4 21:00 about
-rw-r--r--   1 root root 2500 Apr  4 21:00 index.html
```

## 步骤 3.2: 首次手动部署

### 方式 A: 使用 Wrangler CLI

```bash
# 首次部署 (创建项目)
npx wrangler pages publish dist --project-name=first-principles

# 输出示例:
# ✨ Success! Uploaded 15 files
# 🌐 https://first-principles.pages.dev
```

### 方式 B: 使用 Cloudflare Dashboard

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages**
3. 点击 **Create application**
4. 选择 **Pages** → **Upload assets**
5. 项目名称: `first-principles`
6. 上传 `dist/` 目录
7. 点击 **Deploy site**

## 步骤 3.3: 配置自定义域名 (可选)

### 在 Cloudflare 配置

1. 进入 Pages 项目设置
2. 点击 **Custom domains**
3. 添加域名: `firstprinciples.com` (或你的域名)
4. Cloudflare 自动配置 DNS 记录

### DNS 配置

等待 DNS 传播:
```bash
# 检查 DNS 解析
dig firstprinciples.com

# 或使用
nslookup firstprinciples.com
```

## 步骤 3.4: 配置环境变量

### 在 Cloudflare Dashboard 中设置

1. 进入 Pages 项目设置
2. 点击 **Environment variables**
3. 添加以下变量:

```bash
# 生产环境变量
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
APP_NAME=First Principles
ENVIRONMENT=production
```

### 使用 Wrangler CLI 设置

```bash
# 设置环境变量
npx wrangler pages secret put SUPABASE_URL --project-name=first-principles
# 输入: https://your-project.supabase.co

npx wrangler pages secret put SUPABASE_ANON_KEY --project-name=first-principles
# 输入: your-anon-key
```

## 步骤 3.5: 配置构建和部署 (自动化)

### 创建 GitHub Actions 工作流

创建 `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy to Cloudflare Pages

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: first-principles
          directory: dist

      - name: Output deployment URL
        run: echo "Deployed at ${{ steps.deploy.outputs.url }}"
```

### 在 GitHub 设置 Secrets

1. 进入 GitHub 仓库设置
2. 点击 **Secrets and variables** → **Actions**
3. 添加以下 secrets:

```bash
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token
CLOUDFLARE_ACCOUNT_ID=your-account-id
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### 获取 Cloudflare API Token

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. 点击 **Create Token**
3. 选择 **Edit Cloudflare Workers** 模板
4. 权限:
   - Account → Cloudflare Pages → Edit
5. 创建并复制 token

## 步骤 3.6: 测试部署

### 功能测试

```bash
# 访问部署的站点
open https://first-principles.pages.dev

# 或使用自定义域名
open https://firstprinciples.com
```

测试清单:
- [ ] 首页正常加载
- [ ] 用户认证功能 (如有)
- [ ] 创建新对话
- [ ] 发送消息 (测试中文和英文)
- [ ] 查看对话历史
- [ ] 思维导图生成

### 性能测试

```bash
# 使用 Lighthouse 测试性能
npx lighthouse https://first-principles.pages.dev --view

# 预期分数:
# - Performance: 90+
# - Accessibility: 95+
# - Best Practices: 90+
# - SEO: 100
```

### 错误监控

检查浏览器控制台:
```javascript
// 应该看到 Supabase 连接成功
console.log('Supabase URL:', import.meta.env.SUPABASE_URL);

// 应该没有 API 错误
// ✅ Correct: fetch(.../functions/v1/chat)
// ❌ Error: fetch(/api/chat) - 404 Not Found
```

## 步骤 3.7: 配置缓存策略

### Cloudflare 缓存规则

在 Cloudflare Dashboard 中配置:

1. 进入 Pages 项目设置
2. 点击 **Cache Rules**
3. 创建规则:

**静态资源缓存**:
```yaml
# 匹配: _astro/*, *.js, *.css
# 缓存级别: Cache Everything
# 边缘缓存 TTL: 1 year
# 浏览器缓存 TTL: 1 year
```

**HTML 页面缓存**:
```yaml
# 匹配: *.html
# 缓存级别: Standard
# 边缘缓存 TTL: 1 hour
# 浏览器缓存 TTL: 2 hours
```

**API 请求不缓存**:
```yaml
# 匹配: */functions/v1/*
# 缓存级别: No Query String
# 边缘缓存 TTL: Respect Origin Headers
```

## 步骤 3.8: 配置重定向 (可选)

### SPA 路由支持

创建 `_redirects` 文件:

```bash
# 在 dist/ 目录创建
cat > dist/_redirects << 'EOF'
# SPA 路由支持
# /chat/* /chat/:splat 200
# /about /about/ 301

# 首页
/ /index.html 200
EOF
```

### 自定义错误页面

创建 `dist/404.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Not Found - First Principles</title>
</head>
<body>
  <h1>404 - Page Not Found</h1>
  <p>The page you're looking for doesn't exist.</p>
  <a href="/">Go Home</a>
</body>
</html>
```

## 步骤 3.9: 监控和日志

### Cloudflare Analytics

1. 进入 Pages 项目设置
2. 点击 **Analytics**
3. 查看指标:
   - 请求量
   - 带宽使用
   - 错误率
   - 地理分布

### 设置监控告警

```bash
# 使用 Cloudflare API 设置告警
curl -X POST https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/alerts/v1/rules \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{
    "name": "High Error Rate",
    "condition": {
      "metric": "http_requests_error_5xx",
      "threshold": 0.05
    }
  }'
```

## 故障排除

### 问题 1: 部署失败

```bash
# 检查构建日志
npm run build 2>&1 | tee build.log

# 查看错误
grep -i error build.log
```

### 问题 2: 环境变量未生效

```bash
# 验证环境变量
npx wrangler pages secret list --project-name=first-principles

# 重新设置
npx wrangler pages secret put SUPABASE_URL --project-name=first-principles
```

### 问题 3: API 调用 CORS 错误

在 Supabase 中配置 CORS:
```sql
-- 在 Supabase SQL Editor 中执行
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable access for all users" ON conversations
  FOR SELECT USING (true);
```

---

**下一步**: 步骤 3 - 配置 Cloudflare Workers (可选 API 代理)

**当前状态**:
- ✅ 前端已部署到 Cloudflare Pages
- ✅ 全球 CDN 加速已启用
- ✅ 自动部署已配置
- ⏳ 后端逻辑仍在 Supabase Edge Functions