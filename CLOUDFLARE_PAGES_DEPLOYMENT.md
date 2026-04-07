# First Principles - Cloudflare Pages 部署指南

## 🚀 架构说明

**纯前端部署架构**：
```
Cloudflare Pages (静态前端)
    ↓ HTTPS
Supabase Edge Functions (后端 API)
    ↓
Supabase PostgreSQL (数据库)
```

---

## 📋 部署步骤

### 1️⃣ 连接 GitHub 到 Cloudflare Pages

1. **登录 Cloudflare Dashboard**
   - 访问：https://dash.cloudflare.com/
   - 账户：xuewq983@gmail.com

2. **进入 Pages**
   - 左侧菜单 → **Workers & Pages**
   - 点击 **Create application**

3. **连接 GitHub**
   - 选择 **Connect to Git**
   - 授权 Cloudflare 访问您的 GitHub
   - 选择仓库：`XwqDoraemon/first-principles`

---

### 2️⃣ 配置构建设置

在 **Set up a build and deployment** 页面：

```
项目名称：first-principles
生产分支：main
框架预设：None
构建命令：（留空）
构建输出目录：server/public-placeholder
环境变量：（留空）
```

**重要配置**：
- ✅ **Framework preset**: `None`
- ✅ **Build command**: （空）
- ✅ **Build output directory**: `server/public-placeholder`
- ✅ **Root directory**: `/` (根目录)

---

### 3️⃣ 环境变量配置（可选）

在 **Environment variables** 部分：

```bash
# Supabase 配置（前端使用）
SUPABASE_URL=https://bmstklfbnyevuyxidmhv.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 注意：生产环境建议使用 Cloudflare Secrets
```

---

### 4️⃣ 保存并部署

1. 点击 **Save and Deploy**
2. 等待部署完成（约 1-2 分钟）
3. 获得部署 URL：`https://first-principles.pages.dev`

---

## 🔧 自定义域名（可选）

### 添加自定义域名

1. **在 Cloudflare Pages 项目中**
   - 进入 **Custom domains**
   - 点击 **Set up a custom domain**

2. **输入域名**
   - 例如：`first-principles.com`
   - 或子域名：`app.first-principles.com`

3. **配置 DNS**
   - Cloudflare 会自动添加 DNS 记录
   - 等待 DNS 生效（约 24 小时）

---

## 🔄 自动部署

配置完成后，每次推送代码到 `main` 分支：

```bash
git add .
git commit -m "feat: 新功能"
git push origin main
```

Cloudflare Pages 会自动：
1. 检测到 GitHub 更新
2. 构建新版本
3. 部署到生产环境
4. 发送邮件通知到 xuewq983@gmail.com

---

## 📊 部署后配置

### 1. 更新 Supabase CORS 设置

在 Supabase Dashboard 中：

1. 进入 **Authentication** → **URL Configuration**
2. 添加您的 Cloudflare Pages 域名：
   ```
   https://first-principles.pages.dev
   https://your-custom-domain.com
   ```

### 2. 配置 PayPal Webhook

更新 PayPal Webhook URL：

```
https://first-principles.pages.dev/api/webhook
```

### 3. 配置 Stripe Webhook（如果使用）

更新 Stripe Webhook URL：

```
https://first-principles.pages.dev/api/stripe/webhook
```

---

## 🧪 测试部署

部署完成后，测试以下功能：

1. **首页访问**
   - https://first-principles.pages.dev

2. **聊天页面**
   - https://first-principles.pages.dev/chat.html

3. **定价页面**
   - https://first-principles.pages.dev/pricing.html

4. **API 连接**
   - 检查 Supabase 连接状态
   - 测试支付流程

---

## 📈 监控和日志

### Cloudflare Analytics

- 访问：https://dash.cloudflare.com/
- 进入 **Workers & Pages** → **first-principles**
- 查看：
  - 访问量统计
  - 性能指标
  - 错误日志

### Supabase Logs

- 访问：https://supabase.com/dashboard
- 进入 **Edge Functions** → **Logs**
- 查看 API 调用日志

---

## 🔒 安全最佳实践

1. **API 密钥管理**
   - ✅ 使用 Cloudflare Secrets 存储敏感信息
   - ✅ 永远不要在前端暴露 Service Role Key

2. **CORS 配置**
   - ✅ 在 Supabase 中配置允许的域名
   - ✅ 限制 API 访问来源

3. **速率限制**
   - ✅ 在 Supabase Edge Functions 中实现
   - ✅ 防止 API 滥用

---

## 🆚 本地开发 vs 生产环境

| 特性 | 本地开发 | Cloudflare Pages |
|------|----------|------------------|
| **URL** | http://43.153.79.127:4322 | https://first-principles.pages.dev |
| **后端** | Express (本地) | Supabase Edge Functions |
| **数据库** | Supabase | Supabase |
| **HTTPS** | ❌ | ✅ 自动 |
| **CDN** | ❌ | ✅ 全球 CDN |
| **费用** | 免费 | 免费 |

---

## 💰 成本估算

### Cloudflare Pages（免费计划）

- ✅ 无限带宽
- ✅ 无限请求
- ✅ 全球 CDN
- ✅ 自动 HTTPS
- ✅ DDoS 防护

### Supabase（免费计划）

- ✅ 500MB 数据库
- ✅ 1GB 文件存储
- ✅ 50,000 API 请求/月
- ✅ 2 Edge Functions

**总成本**：$0/月

---

## 🚨 故障排查

### 问题 1：页面无法访问

**检查**：
- [ ] Cloudflare Pages 部署状态
- [ ] 构建输出目录是否正确
- [ ] DNS 是否生效

### 问题 2：API 连接失败

**检查**：
- [ ] Supabase CORS 设置
- [ ] API 密钥是否正确
- [ ] Edge Functions 是否部署

### 问题 3：支付失败

**检查**：
- [ ] Webhook URL 是否更新
- [ ] 环境变量是否配置
- [ ] PayPal/Stripe 配置是否正确

---

## 📞 需要帮助？

Boss，部署过程中遇到问题随时告诉我：
- Cloudflare Pages 配置问题
- GitHub 集成问题
- 域名配置问题
- 支付集成问题

---

## ✅ 部署检查清单

- [x] GitHub 仓库已创建
- [ ] Cloudflare Pages 项目已创建
- [ ] 构建设置已配置
- [ ] 环境变量已添加
- [ ] 首次部署成功
- [ ] 自定义域名已配置（可选）
- [ ] Supabase CORS 已更新
- [ ] PayPal Webhook 已更新
- [ ] 所有功能测试通过

---

Boss，配置文件已创建完成！现在您可以：
1. 访问 Cloudflare Dashboard
2. 按照上述步骤配置 Pages
3. 自动部署到全球 CDN

需要我帮您检查配置吗？
