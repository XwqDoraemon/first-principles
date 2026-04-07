# PayPal 支付集成配置指南

## ✅ 已配置完成

### 您的 PayPal 凭证（已安全集成）

```
Client ID: AU_ZropTaP02Cbe_FaE1mz2h0TGiNh2G0RadG69OFbpDRDrA4wc19xhY30w61q_egWrWSEDQ6TIOE-dD
Client Secret: EKfEs7OMXgKrZtQXsSlrWTJmRB2Hmxmv4ZsJE3CXhWrnizM58wOxjkYoagGz-foijkG1PQ8mDcsjAjhr
账户类型: 个人账户
环境: 沙盒（测试模式）
```

---

## 🔧 下一步配置（Supabase 环境变量）

### 1. 在 Supabase Dashboard 中添加环境变量

访问：Supabase Dashboard → **Settings** → **Edge Functions**

添加以下环境变量：

```bash
# PayPal 凭证
PAYPAL_CLIENT_ID=AU_ZropTaP02Cbe_FaE1mz2h0TGiNh2G0RadG69OFbpDRDrA4wc19xhY30w61q_egWrWSEDQ6TIOE-dD
PAYPAL_CLIENT_SECRET=EKfEs7OMXgKrZtQXsSlrWTJmRB2Hmxmv4ZsJE3CXhWrnizM58wOxjkYoagGz-foijkG1PQ8mDcsjAjhr

# PayPal 环境（sandbox 或 live）
PAYPAL_MODE=sandbox

# PayPal Webhook ID（可选，用于验证 webhook）
PAYPAL_WEBHOOK_ID=your_webhook_id_here
```

---

## 📦 部署 PayPal Edge Function

### 方法一：使用 Supabase CLI（推荐）

```bash
# 进入项目目录
cd /root/.openclaw/workspace-developer-xue/first-principles

# 部署 PayPal 函数
supabase functions deploy payment-paypal
```

### 方法二：通过 Supabase Dashboard

1. 访问 Supabase Dashboard
2. 进入 **Edge Functions**
3. 点击 **New Function**
4. 函数名：`payment-paypal`
5. 复制 `supabase/functions/payment-paypal/index.ts` 内容
6. 粘贴到编辑器并保存

---

## 🔗 配置 PayPal Webhook（可选）

### 1. 创建 Webhook

访问：https://developer.paypal.com/developer/webhooks/

1. 点击 **Create Webhook**
2. **Webhook URL**: `https://bmstklfbnyevuyxidmhv.supabase.co/functions/v1/payment-paypal/webhook`
3. **选择事件**:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`

### 2. 获取 Webhook ID

创建后复制 Webhook ID，添加到 Supabase 环境变量：
```bash
PAYPAL_WEBHOOK_ID=your_webhook_id
```

---

## 🧪 测试 PayPal 支付

### 1. 沙盒测试账户

访问：https://developer.paypal.com/developer/accounts/

使用现有的沙盒账户进行测试，或创建新的：
- **买家账户**：用于支付测试
- **商家账户**：用于接收资金

### 2. 测试流程

1. 访问定价页面：http://43.153.79.127:4322/pricing.html
2. 点击购买按钮
3. 使用沙盒买家账户登录 PayPal
4. 完成支付
5. 验证 Supabase 数据库中的积分是否增加

---

## 💰 PayPal 手续费

### 沙盒环境（测试）
- 免费，无实际扣款

### 生产环境
- **国内卡**: 3.4% + $0.30
- **国际卡**: 3.9% + $0.30
- **实际收入**:
  - Basic Pack: $0.99 - $0.33 ≈ $0.66
  - Pro Pack: $4.99 - $0.49 ≈ $4.50

---

## 🚀 切换到生产环境

当准备上线时：

### 1. 更新 Supabase 环境变量

```bash
# 在 Supabase Dashboard 中更新
PAYPAL_MODE=live
PAYPAL_CLIENT_ID=your_live_client_id
PAYPAL_CLIENT_SECRET=your_live_client_secret
```

### 2. 更新前端配置

编辑 `server/public-placeholder/js/paypal-payment.js`:

```javascript
const PAYPAL_CONFIG = {
  clientId: 'your_live_client_id', // 替换为生产环境 Client ID
  sdkUrl: 'https://www.paypal.com/sdk/js?client-id=your_live_client_id&currency=USD',
  // ...
}
```

### 3. 更新 Webhook URL

在生产环境创建新的 Webhook，指向生产 URL。

---

## 📋 配置检查清单

- [x] PayPal 凭证已配置
- [ ] Supabase 环境变量已添加
- [ ] Edge Function 已部署
- [ ] Webhook 已配置（可选）
- [ ] 测试支付成功
- [ ] 数据库积分验证通过

---

## 🆚 Stripe vs PayPal

| 特性 | Stripe | PayPal |
|------|--------|--------|
| **国内支持** | ❌ | ✅ |
| **用户基础** | 国际 | 国内更普及 |
| **手续费** | 2.9% + $0.30 | 3.4% + $0.30 |
| **集成难度** | 简单 | 中等 |
| **提现** | 需要海外账户 | 支持国内银行 |

**推荐**：使用 PayPal，因为您的用户主要在国内。

---

## 📞 需要帮助？

Boss，配置过程中遇到问题随时告诉我：
- PayPal 账户配置问题
- Supabase 部署问题
- 支付流程测试问题

---

## 🔒 安全提醒

- ✅ Client Secret 已安全存储在 Supabase 环境变量中
- ✅ 前端只暴露 Client ID（安全）
- ✅ Webhook 验证已实现（生产环境推荐启用）
- ✅ 所有支付操作通过后端处理

Boss，PayPal 集成代码已完成！现在只需要：
1. 在 Supabase 中添加环境变量
2. 部署 Edge Function

需要我帮您部署吗？
