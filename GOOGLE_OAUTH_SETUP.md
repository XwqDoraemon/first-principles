# Google OAuth 登录配置指南

## ✅ 已完成

- [x] 创建认证 JavaScript 模块 (`js/auth.js`)
- [x] 创建登录弹窗 UI (`auth-modal.html`)
- [x] 更新首页集成登录功能

---

## 🔧 配置步骤

### 第一步：Google Cloud Console

#### 1. 创建项目

访问：https://console.cloud.google.com/apis/credentials

1. 点击顶部项目选择器
2. 点击 **新建项目**
3. 项目名称：`first-principles`
4. 点击 **创建**

#### 2. 启用 Google+ API

1. 访问：https://console.cloud.google.com/apis/library
2. 搜索 **Google+ API** 或 **People API**
3. 点击 **启用**

#### 3. 配置 OAuth 同意屏幕

1. 访问：https://console.cloud.google.com/apis/credentials/consent
2. 点击 **创建 OAuth 同意屏幕**
3. 选择 **外部** 用户类型
4. 填写应用信息：

```
应用名称*: First Principles
用户支持电子邮件*: xuewq983@gmail.com
应用首页*: https://firstprinciples.site
应用隐私政策链接*: https://firstprinciples.site/privacy
应用服务条款链接*: https://firstprinciples.site/terms
应用图标: (可选)
应用徽标: (可选)
```

5. 授权域：
```
firstprinciples.site
first-principles-d8q.pages.dev
```

6. 开发者联系信息：
```
电子邮件地址*: xuewq983@gmail.com
```

7. 点击 **保存并继续**（跳过其他步骤）

#### 4. 创建 OAuth 2.0 客户端 ID

1. 访问：https://console.cloud.google.com/apis/credentials
2. 点击 **创建凭据** → **OAuth 客户端 ID**
3. 应用类型：**Web 应用**
4. 名称：`First Principles Web`
5. 已授权的重定向 URI：
```
https://bmstklfbnyevuyxidmhv.supabase.co/auth/v1/callback
```

6. 点击 **创建**
7. 复制并保存：
   - **客户端 ID**：`xxxxx.apps.googleusercontent.com`
   - **客户端密钥**：`GOCSPX-xxxxxxxxx`

---

### 第二步：Supabase 配置

#### 1. 启用 Google Provider

1. 登录 Supabase Dashboard：https://supabase.com/dashboard
2. 选择项目：`first-principles`
3. 进入 **Authentication** → **Providers**
4. 找到 **Google** 并点击启用
5. 填写 Google 凭证：

```
Client ID: [粘贴 Google 客户端 ID]
Client Secret: [粘贴 Google 客户端密钥]
```

6. 点击 **保存**

#### 2. 配置 Site URL

1. 进入 **Authentication** → **URL Configuration**
2. 添加允许的重定向 URL：

```
https://firstprinciples.site/*
https://first-principles-d8q.pages.dev/*
```

3. 点击 **保存**

---

### 第三步：域名 DNS 配置

#### 配置 firstprinciples.site

1. **登录域名注册商**
   - 访问您的域名注册商（如 GoDaddy、Namecheap、阿里云等）

2. **添加 DNS 记录**

   如果您的域名托管在 Cloudflare：
   
   ```
   类型: CNAME
   名称: firstprinciples.site (或 @)
   目标: first-principles-d8q.pages.dev
   代理: 已启用 (橙色云朵)
   ```

   如果使用其他 DNS：
   
   ```
   类型: CNAME
   名称: @
   目标: first-principles-d8q.pages.dev
   TTL: 3600
   ```

3. **在 Cloudflare Pages 添加自定义域名**

   1. 登录 Cloudflare Dashboard
   2. 进入 **Workers & Pages** → **first-principles**
   3. 点击 **Custom domains**
   4. 点击 **Set up a custom domain**
   5. 输入：`firstprinciples.site`
   6. 点击 **Continue**
   7. Cloudflare 会自动添加 DNS 记录

4. **等待 DNS 生效**
   - 通常需要 5-30 分钟
   - 可以使用 https://dnschecker.org 检查

---

### 第四步：更新 Supabase 允许的域名

在 Supabase Dashboard 中：

1. 进入 **Authentication** → **URL Configuration**
2. 添加新域名：
```
https://firstprinciples.site/*
```

3. 保存

---

## 🧪 测试登录

### 1. 测试 Google 登录

1. 访问：https://firstprinciples.site
2. 点击右上角 **登录** 按钮
3. 点击 **使用 Google 继续**
4. 选择您的 Google 账户
5. 授权应用
6. 自动返回网站并登录

### 2. 测试邮箱登录

1. 点击 **登录**
2. 输入邮箱和密码
3. 首次使用会自动创建账户

### 3. 检查用户数据

1. 登录后显示：
   - 用户头像
   - 邮箱地址
   - 积分余额

2. Supabase Dashboard 验证：
   - Authentication → Users
   - 可以看到新注册的用户

---

## 📋 配置检查清单

- [ ] Google Cloud Console 项目已创建
- [ ] Google+ API 已启用
- [ ] OAuth 同意屏幕已配置
- [ ] OAuth 客户端 ID 已创建
- [ ] Supabase Google Provider 已启用
- [ ] Supabase Site URL 已配置
- [ ] 域名 DNS 已配置
- [ ] Cloudflare Pages 自定义域名已添加
- [ ] DNS 已生效
- [ ] 测试 Google 登录成功
- [ ] 测试邮箱登录成功
- [ ] 用户数据正确显示

---

## 🚨 常见问题

### 问题 1：Google 登录后跳转错误

**解决方案**：
1. 检查 Supabase 的 Site URL 配置
2. 确认重定向 URL 正确
3. 清除浏览器缓存

### 问题 2：DNS 未生效

**解决方案**：
1. 等待 24 小时（通常更快）
2. 使用 https://dnschecker.org 检查
3. 确认 DNS 记录正确

### 问题 3：用户登录后无数据

**解决方案**：
1. 检查 Supabase Database
2. 确认 `users` 表存在
3. 检查 RLS 策略

---

## 🔒 安全建议

1. **API 密钥安全**
   - ✅ Google Client Secret 只存储在 Supabase
   - ✅ 前端只暴露 Client ID

2. **域名验证**
   - ✅ 在 Google Console 中添加所有使用的域名
   - ✅ 在 Supabase 中配置允许的重定向 URL

3. **用户数据保护**
   - ✅ 启用 Supabase RLS
   - ✅ 限制用户只能访问自己的数据

---

Boss，Google OAuth 配置指南已创建完成！

**下一步**：
1. 按照上述步骤配置 Google Cloud Console
2. 配置 Supabase
3. 配置域名 DNS
4. 测试登录功能

需要我帮您检查配置或解决遇到的问题吗？
