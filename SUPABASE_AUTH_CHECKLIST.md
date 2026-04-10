# Supabase Auth 配置检查清单

## 🔧 问题诊断

当前错误：`redirect_to` URL 未在 Supabase 允许列表中

---

## ✅ 检查清单

### 1️⃣ Supabase Dashboard 配置

**Authentication → URL Configuration**

- [ ] **Site URL**: 设置为 `https://firstprinciples.site`
- [ ] **Redirect URLs**: 添加以下 URL：
  ```
  https://firstprinciples.site/*
  https://firstprinciples.site/
  https://firstprinciples.site/chat.html
  https://first-principles-d8q.pages.dev/*
  ```

### 2️⃣ Google Cloud Console 配置

**API & Services → Credentials**

- [ ] **Authorized redirect URIs** 包含：
  ```
  https://bmstklfbnyevuyxidmhv.supabase.co/auth/v1/callback
  ```

### 3️⃣ 测试步骤

1. 访问 `https://firstprinciples.site`
2. 点击"登录"按钮
3. 点击"使用 Google 继续"
4. 选择 Google 账户
5. 确认授权
6. 应该跳转回 `https://firstprinciples.site`

---

## 🚨 如果仍然有问题

### 方案 A：临时简化（推荐先试）

修改 `public/js/auth.js` 中的 `signInWithGoogle` 函数：

```javascript
async function signInWithGoogle() {
  try {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://firstprinciples.site/',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    // ...
  }
}
```

### 方案 B：在本地测试

如果在本地测试（`http://43.153.79.127:4322`），在 Supabase Dashboard 中添加：

```
http://43.153.79.127:4322/*
```

---

## 📝 快速验证

在浏览器控制台运行以下命令检查当前 URL：

```javascript
window.location.origin
// 应该输出："https://firstprinciples.site"
```

---

## 🆘 需要帮助？

如果配置后仍然有问题，请告诉我：
1. 您在访问哪个 URL？
2. Supabase Dashboard 中的 Site URL 设置是什么？
3. Redirect URLs 列表中有哪些？
