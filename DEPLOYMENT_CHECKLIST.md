# First Principles - 部署检查清单

## ✅ 已完成

### 前端
- [x] 首页 (index.html) - 已修复导航链接
- [x] 聊天页面 (chat.html) - 已移除右上角状态，中央显示连接状态
- [x] 定价页面 (pricing.html) - 已创建并集成支付按钮
- [x] Logo 统一 - 已修改为 "First Principles"

### 数据库架构
- [x] 用户表 (users) - 积分余额、总会话数
- [x] 会话表 (conversations) - 消息、阶段、思维导图
- [x] 积分交易表 (credit_transactions) - 充值、消费记录
- [x] 订单表 (orders) - 支付订单状态
- [x] RLS 策略 - 用户数据隔离
- [x] 触发器 - 自动更新时间戳
- [x] 存储过程 - 积分扣除/添加函数

### 后端 (Supabase Edge Functions)
- [x] 支付函数 (payment/index.ts)
  - 创建支付意图
  - Webhook 处理
  - 积分查询
- [x] 聊天函数 (chat/index.ts) - 已有

### 前端集成
- [x] 支付 JS 库 (js/payment.js)
  - Stripe 初始化
  - 支付流程
  - 积分查询
- [x] 定价页面集成

---

## 🔧 待配置（需要 Boss 操作）

### 1. Stripe 账户设置
- [ ] 注册 Stripe 账户
- [ ] 获取测试 API 密钥
  - [ ] Publishable Key (PK)
  - [ ] Secret Key (SK)
  - [ ] Webhook Signing Secret

### 2. Supabase 配置
- [ ] 在 Supabase Dashboard 添加环境变量:
  ```
  STRIPE_SECRET_KEY=sk_test_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  ```

- [ ] 运行数据库迁移:
  ```bash
  # 在 Supabase SQL Editor 中运行
  supabase/migrations/001_create_users_and_credits.sql
  ```

- [ ] 部署 Edge Function:
  ```bash
  cd supabase/functions/payment
  supabase functions deploy payment
  ```

### 3. Stripe Webhook 配置
- [ ] 在 Stripe Dashboard 创建 Webhook
- [ ] Endpoint URL: `https://bmstklfbnyevuyxidmhv.supabase.co/functions/v1/payment/webhook`
- [ ] 监听事件:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`

### 4. 前端配置更新
- [ ] 编辑 `server/public-placeholder/js/payment.js`
  ```javascript
  publishableKey: 'pk_test_your_actual_key', // 替换这里
  ```

---

## 📋 部署步骤

### 第一步：Stripe 配置
1. 访问 https://dashboard.stripe.com
2. 获取 API 密钥
3. 保存到安全位置

### 第二步：Supabase 数据库
1. 访问 Supabase SQL Editor
2. 复制 `supabase/migrations/001_create_users_and_credits.sql` 内容
3. 运行 SQL

### 第三步：Supabase Edge Functions
```bash
# 安装 Supabase CLI（如果没有）
npm install -g supabase

# 登录
supabase login

# 链接项目
supabase link --project-ref bmstklfbnyevuyxidmhv

# 部署支付函数
supabase functions deploy payment
```

### 第四步：配置环境变量
在 Supabase Dashboard → Settings → Edge Functions 添加:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 第五步：配置 Webhook
1. Stripe Dashboard → Webhooks → Add endpoint
2. URL: `https://bmstklfbnyevuyxidmhv.supabase.co/functions/v1/payment/webhook`
3. 选择事件: `payment_intent.succeeded`, `payment_intent.payment_failed`
4. 复制签名密钥到 Supabase 环境变量

### 第六步：更新前端
编辑 `server/public-placeholder/js/payment.js`:
```javascript
const STRIPE_CONFIG = {
  publishableKey: 'pk_test_your_actual_key_here', // 替换
  // ...
}
```

---

## 🧪 测试流程

### 1. 测试支付
1. 访问 http://43.153.79.127:4322/pricing.html
2. 点击 "Buy $0.99"
3. 使用测试卡: `4242 4242 4242 4242`
4. 完成支付

### 2. 验证积分
- 检查 Supabase 数据库 `users` 表
- 确认 `credits_balance` 增加

### 3. 测试会话扣费
- 开始新会话
- 完成一次对话
- 确认积分扣除

---

## 💰 定价策略

| 套餐 | 价格 | 积分 | 单次成本 |
|------|------|------|----------|
| 免费试用 | $0 | 2 | $0 |
| Basic Pack | $0.99 | 5 | ~$0.20 |
| Pro Pack | $4.99 | 30 | ~$0.17 |

### Stripe 费用计算
- Basic Pack: $0.99 - ($0.99 × 2.9% + $0.30) = $0.66 净收入
- Pro Pack: $4.99 - ($4.99 × 2.9% + $0.30) = $4.50 净收入

---

## 🚀 生产环境切换

当准备上线时：

1. **替换密钥**:
   - `pk_test_...` → `pk_live_...`
   - `sk_test_...` → `sk_live_...`

2. **更新 Webhook URL**:
   - 确保指向生产环境

3. **测试真实支付**:
   - 小额测试验证流程

---

## 📞 需要帮助？

Boss，配置过程中遇到问题随时告诉我：
- Stripe 配置问题
- Supabase 部署问题
- 支付流程测试问题

我会帮您解决！
