# PayPal 支付 - 快速开始

## 📦 已创建的文件

### 数据库
```
supabase/migrations/
  └── 001_create_users_and_credits.sql    # 数据库表和函数
```

### 后端
```
supabase/functions/payment-paypal/
  └── index.ts                             # PayPal 集成 Edge Function
```

### 前端
```
server/public-placeholder/
  ├── pricing.html                         # 定价页面（已集成支付）
  └── js/
      └── paypal-payment.js                # PayPal 支付逻辑
```

### 文档
```
└── CLOUDFLARE_PAGES_DEPLOYMENT.md         # Cloudflare 部署检查清单
```

---

## ⚡ 5 分钟快速配置

### 1. 获取 PayPal 凭证（2 分钟）

```bash
# 访问 https://developer.paypal.com
# 创建一个 REST API App，复制以下值：
- Client ID
- Secret
```

### 2. 配置 Supabase（2 分钟）

```bash
# A. 添加环境变量
# Supabase Dashboard → Settings → Edge Functions
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox

# B. 运行数据库迁移
# Supabase Dashboard → SQL Editor
# 复制并运行 supabase/migrations/001_create_users_and_credits.sql

# C. 部署 Edge Function
supabase functions deploy payment-paypal
```

### 3. 更新前端 Client ID（1 分钟）

```javascript
// 编辑 public/js/paypal-payment.js
const PAYPAL_CONFIG = {
  clientId: '你的 PayPal Client ID',
}
```

### 4. 可选：配置 Webhook（生产环境推荐）

```bash
# Webhook URL
https://<your-project>.supabase.co/functions/v1/payment-paypal/webhook

# 推荐事件
CHECKOUT.ORDER.APPROVED
PAYMENT.CAPTURE.COMPLETED
```

---

## 🎯 测试

```bash
# 1. 访问定价页面
http://43.153.79.127:4322/pricing.html

# 2. 点击购买按钮

# 3. 使用 PayPal Sandbox 买家账号完成支付
# 4. 验证支付完成后页面提示成功

# 4. 验证积分
# 检查 Supabase users 表的 credits_balance 字段
```

---

## 💡 关键功能

### ✅ 已实现
- [x] 用户注册自动赠送 2 次免费
- [x] PayPal 支付集成
- [x] 积分系统（充值、消费）
- [x] 订单管理
- [x] 支付成功自动加积分
- [x] 前端支付流程
- [x] 登录态校验

### 🔒 安全特性
- RLS（行级安全）确保用户只能访问自己的数据
- 服务端通过用户登录态创建订单
- Service Role Key 用于服务端操作
- 前端只暴露 PayPal Client ID

---

## 📊 数据流程

```
用户点击购买
    ↓
前端加载 PayPal Checkout
    ↓
前端调用 /create-order
    ↓
Supabase Edge Function 创建 PayPal Order
    ↓
用户在 PayPal 弹窗内完成支付
    ↓
前端调用 /capture-order
    ↓
Supabase 捕获订单并添加积分
    ↓
用户获得积分，可以开始会话
```

---

## 🚨 常见问题

**Q: 支付失败怎么办？**
A: 先检查 Supabase Edge Function `payment-paypal` 的日志，再检查 PayPal Sandbox 订单状态。

**Q: 积分没有增加？**
A: 检查 `orders` 表里该订单是否已标记为 `completed`，以及 `add_credits` 是否执行成功。

**Q: 如何切换到生产环境？**
A: 将 `PAYPAL_MODE` 改为 `live`，并替换成正式环境的 `PAYPAL_CLIENT_ID` 和 `PAYPAL_CLIENT_SECRET`。
