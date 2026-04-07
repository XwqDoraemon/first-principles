# Stripe 支付集成配置指南

## 前置要求

1. **Stripe 账户**
   - 注册 [Stripe 账户](https://stripe.com)
   - 获取 API 密钥

2. **Supabase 项目**
   - 已有 Supabase 项目
   - 已配置认证

## 配置步骤

### 1. 获取 Stripe API 密钥

登录 [Stripe Dashboard](https://dashboard.stripe.com/apikeys):

- **可发布密钥 (PK)**: `pk_test_...` 或 `pk_live_...`
- **密钥 (SK)**: `sk_test_...` 或 `sk_live_...`
- **Webhook 签名密钥**: 在 Webhooks 页面创建 webhook 后获取

### 2. 配置 Supabase 环境变量

在 Supabase Dashboard 中添加以下密钥：

1. 进入 **Settings** → **Edge Functions**
2. 添加环境变量：

```bash
# Stripe 密钥
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Supabase 密钥（已有）
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. 运行数据库迁移

在 Supabase SQL Editor 中运行：

```sql
-- 复制并运行 supabase/migrations/001_create_users_and_credits.sql
```

### 4. 部署 Edge Function

```bash
# 进入函数目录
cd supabase/functions/payment

# 部署到 Supabase
supabase functions deploy payment
```

### 5. 配置 Stripe Webhook

1. 在 Stripe Dashboard 中创建 Webhook
2. **Endpoint URL**: `https://your-project.supabase.co/functions/v1/payment/webhook`
3. **监听事件**:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. 复制 Webhook 签名密钥到环境变量

### 6. 更新前端配置

编辑 `server/public-placeholder/js/payment.js`:

```javascript
const STRIPE_CONFIG = {
  publishableKey: 'pk_test_your_actual_publishable_key', // 替换为你的 PK
  // ...
}
```

## 测试支付

### 测试卡号

使用 Stripe 测试卡号：

- **卡号**: `4242 4242 4242 4242`
- **CVC**: 任意 3 位数字
- **过期日期**: 任意未来日期

### 测试流程

1. 访问 `/pricing.html`
2. 点击购买按钮
3. 使用测试卡完成支付
4. 检查 Supabase 数据库中的积分是否增加

## 生产环境配置

切换到生产环境时：

1. 将测试密钥替换为生产密钥
2. 更新 Webhook URL 为生产地址
3. 在 Stripe 中启用生产模式

## 定价说明

- **Basic Pack**: $0.99 = 5 credits (~$0.20 per session)
- **Pro Pack**: $4.99 = 30 credits (~$0.17 per session)
- **新用户**: 2 free credits

## Stripe 费用

- **国内卡**: 2.9% + $0.30
- **国际卡**: 3.9% + $0.30
- **实际收入**:
  - Basic Pack: $0.99 - $0.33 ≈ $0.66
  - Pro Pack: $4.99 - $0.49 ≈ $4.50

## 安全注意事项

- ✅ 永远不要在前端暴露 `STRIPE_SECRET_KEY`
- ✅ 使用 `service_role_key` 而非 `anon_key` 在服务端
- ✅ 验证 Webhook 签名
- ✅ 使用 RLS 限制数据访问
