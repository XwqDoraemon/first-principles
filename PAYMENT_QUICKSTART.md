# 支付集成 - 快速开始

## 📦 已创建的文件

### 数据库
```
supabase/migrations/
  └── 001_create_users_and_credits.sql    # 数据库表和函数
```

### 后端
```
supabase/functions/payment/
  └── index.ts                             # Stripe 集成 Edge Function
```

### 前端
```
server/public-placeholder/
  ├── pricing.html                         # 定价页面（已集成支付）
  └── js/
      └── payment.js                       # 支付逻辑
```

### 文档
```
├── STRIPE_SETUP.md                        # Stripe 详细配置指南
└── DEPLOYMENT_CHECKLIST.md                # 部署检查清单
```

---

## ⚡ 5 分钟快速配置

### 1. 获取 Stripe 密钥（2 分钟）

```bash
# 访问 https://dashboard.stripe.com/test/apikeys
# 复制以下密钥：
- Publishable Key: pk_test_...
- Secret Key: sk_test_...
```

### 2. 配置 Supabase（2 分钟）

```bash
# A. 添加环境变量
# Supabase Dashboard → Settings → Edge Functions
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# B. 运行数据库迁移
# Supabase Dashboard → SQL Editor
# 复制并运行 supabase/migrations/001_create_users_and_credits.sql

# C. 部署 Edge Function
supabase functions deploy payment
```

### 3. 配置 Webhook（1 分钟）

```bash
# Stripe Dashboard → Webhooks → Add endpoint
URL: https://bmstklfbnyevuyxidmhv.supabase.co/functions/v1/payment/webhook
Events: payment_intent.succeeded, payment_intent.payment_failed
```

### 4. 更新前端配置

```javascript
// 编辑 server/public-placeholder/js/payment.js
const STRIPE_CONFIG = {
  publishableKey: 'pk_test_your_actual_key', // 替换这里
}
```

---

## 🎯 测试

```bash
# 1. 访问定价页面
http://43.153.79.127:4322/pricing.html

# 2. 点击购买按钮

# 3. 使用测试卡
卡号: 4242 4242 4242 4242
CVC: 任意 3 位
过期: 任意未来日期

# 4. 验证积分
# 检查 Supabase users 表的 credits_balance 字段
```

---

## 💡 关键功能

### ✅ 已实现
- [x] 用户注册自动赠送 2 次免费
- [x] Stripe 支付集成
- [x] 积分系统（充值、消费）
- [x] 订单管理
- [x] Webhook 自动处理
- [x] 前端支付流程
- [x] 积分查询 API

### 🔒 安全特性
- RLS（行级安全）确保用户只能访问自己的数据
- Webhook 签名验证
- Service Role Key 用于服务端操作
- 前端只暴露 Publishable Key

---

## 📊 数据流程

```
用户点击购买
    ↓
前端调用 /create-payment-intent
    ↓
Supabase Edge Function 创建 Stripe PaymentIntent
    ↓
前端显示 Stripe 支付表单
    ↓
用户完成支付
    ↓
Stripe 发送 Webhook
    ↓
Supabase 接收 Webhook，添加积分
    ↓
用户获得积分，可以开始会话
```

---

## 🚨 常见问题

**Q: 支付失败怎么办？**
A: 检查 Stripe Dashboard 的日志，确认 Webhook 是否成功发送。

**Q: 积分没有增加？**
A: 检查 Supabase Edge Functions 日志，确认 `add_credits` 函数是否执行。

**Q: 如何切换到生产环境？**
A: 将 `pk_test_` 和 `sk_test_` 替换为 `pk_live_` 和 `sk_live_`。

---

Boss，支付系统已经完全集成完毕！只需要按照上述步骤配置 Stripe 密钥即可开始使用。

需要我帮您测试或调整什么吗？
