# Supabase 自定义域名配置指南

## 🎯 两种方案

### 方案 1：Vanity Subdomain（推荐先尝试）
- **域名格式**：`firstprinciples.supabase.co`
- **费用**：需要组织在付费计划上
- **优点**：配置简单，更美观的域名

### 方案 2：Custom Domain（完全自定义）
- **域名格式**：`api.firstprinciples.site`
- **费用**：付费附加功能
- **优点**：完全隐藏 Supabase 域名

---

## 📋 前置检查

1. 确认您的 Supabase 组织是否在付费计划上
2. 确认您有项目的 Owner 或 Admin 权限
3. 安装 Supabase CLI

---

## 🚀 方案 1：Vanity Subdomain 配置

### 第一步：安装 Supabase CLI

```bash
# 使用 npm 安装
npm install -g supabase

# 或使用 Homebrew（macOS）
brew install supabase/tap/supabase
```

### 第二步：登录 Supabase

```bash
supabase login
```

### 第三步：检查子域名可用性

```bash
# 项目 REF：bmstklfbnyevuyxidmhv
supabase vanity-subdomains \
  --project-ref bmstklfbnyevuyxidmhv \
  check-availability \
  --desired-subdomain firstprinciples \
  --experimental
```

### 第四步：准备 OAuth 回调

在 Google Cloud Console 中添加新的回调 URL：
```
https://firstprinciples.supabase.co/auth/v1/callback
```

### 第五步：激活子域名

```bash
supabase vanity-subdomains \
  --project-ref bmstklfbnyevuyxidmhv \
  activate \
  --desired-subdomain firstprinciples \
  --experimental
```

### 第六步：更新前端代码

修改 `public/js/auth.js`：

```javascript
const SUPABASE_URL = 'https://firstprinciples.supabase.co';
```

---

## 💰 方案 2：Custom Domain 配置

### 第一步：选择子域名

推荐使用：`api.firstprinciples.site`

### 第二步：添加 CNAME 记录

在 Cloudflare DNS 中添加：
```
类型：CNAME
名称：api
目标：bmstklfbnyevuyxidmhv.supabase.co
代理：已禁用（灰色云朵）
TTL：自动
```

### 第三步：安装 Supabase CLI

```bash
npm install -g supabase
supabase login
```

### 第四步：创建自定义域名

```bash
supabase domains create \
  --project-ref bmstklfbnyevuyxidmhv \
  --custom-hostname api.firstprinciples.site
```

### 第五步：添加 TXT 验证记录

根据输出，在 Cloudflare DNS 中添加 TXT 记录：
```
类型：TXT
名称：_acme-challenge.api
值：[从命令输出获取]
TTL：自动
```

### 第六步：验证域名

```bash
supabase domains reverify \
  --project-ref bmstklfbnyevuyxidmhv
```

### 第七步：准备 OAuth 回调

在 Google Cloud Console 中添加：
```
https://api.firstprinciples.site/auth/v1/callback
```

### 第八步：激活域名

```bash
supabase domains activate \
  --project-ref bmstklfbnyevuyxidmhv
```

### 第九步：更新前端代码

修改 `public/js/auth.js`：

```javascript
const SUPABASE_URL = 'https://api.firstprinciples.site';
```

---

## 🔄 更新 Supabase 控制台配置

无论选择哪个方案，都需要在 Supabase Dashboard 中更新：

1. **Authentication → URL Configuration**
   - Site URL: `https://firstprinciples.site`
   - Redirect URLs: 添加新域名的回调

2. **Authentication → Providers → Google**
   - 确认配置正确

---

## ✅ 配置检查清单

- [ ] Supabase CLI 已安装
- [ ] 已登录 Supabase 账户
- [ ] 检查子域名可用性
- [ ] DNS 记录已添加
- [ ] OAuth 回调 URL 已更新
- [ ] 域名已激活
- [ ] 前端代码已更新
- [ ] Supabase 控制台配置已更新
- [ ] 测试登录功能

---

## 🚨 注意事项

1. **Vanity Subdomain** 需要组织在付费计划上
2. **Custom Domain** 是付费附加功能
3. DNS  propagation 可能需要 5-30 分钟
4. SSL 证书颁发可能需要最多 30 分钟
5. 激活前确保所有 OAuth 回调 URL 已添加

---

## 🆘 需要帮助？

如果遇到问题，请告诉我：
- 您想使用哪个方案？
- 您的 Supabase 组织是否在付费计划上？
- 配置过程中遇到什么错误？
