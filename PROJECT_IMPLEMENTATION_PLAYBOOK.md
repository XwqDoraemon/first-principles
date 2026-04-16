# First Principles 项目技术实现与复用手册

## 1. 文档目标

这份文档不是单纯复述代码，而是把当前项目已经验证过的实现方式、登录与支付链路、容易踩坑的点、以及更稳定的升级方案，整理成一份以后做类似网站可以直接复用的实施手册。

适用场景：

- 静态前端站点 + 第三方登录 + 支付充值 + AI 对话类产品
- SaaS MVP、工具站、内容付费站、额度制服务站
- 使用 Cloudflare Pages 托管前端、Supabase 托管认证/数据库/函数的项目

---

## 2. 当前项目的整体技术架构

### 2.1 技术栈

- 前端：原生 HTML + CSS + JavaScript
- 静态托管：Cloudflare Pages
- 本地开发服务器：Express（`server/index.cjs`）
- 后端 API：Supabase Edge Functions（Deno）
- 数据库：Supabase PostgreSQL
- 登录系统：Supabase Auth
- AI 能力：DeepSeek API
- 支付：PayPal 为主，Stripe 为预留方案
- 会话/额度：PostgreSQL 表 + RPC 函数 + Edge Function 协同

### 2.2 目录职责

- `public/`
  - 线上部署的静态页面
  - `public/js/auth.js`：登录态、OAuth、会话恢复、额度展示
  - `public/js/paypal-payment.js`：PayPal 前端支付流程
  - `public/js/payment.js`：Stripe 预留实现，当前不是主链路
- `server/index.cjs`
  - 本地开发时提供静态页面和简单代理
- `supabase/functions/`
  - `chat/`：AI 对话主入口
  - `conversations/`：历史会话读取
  - `payment/`：额度查询 + Stripe 预留能力
  - `payment-paypal/`：PayPal 下单、扣款确认、订单入账
  - `health/`：健康检查
- `supabase/migrations/`
  - 用户、会话、订单、额度、RPC 函数等数据库结构

### 2.3 当前架构的核心优点

- 前端完全静态化，部署简单、成本低、速度快
- 登录、数据库、函数、权限统一放在 Supabase，后端边界清晰
- 支付和额度没有放在前端做“假记账”，而是由服务端落订单、加积分
- 聊天计费不是“点发送就扣钱”，而是“首条 AI 有效回复成功后再正式扣减”，用户体验更合理

### 2.4 当前架构的边界

- 配置项分散在多个前端文件里，后续复用成本偏高
- PayPal 当前主链路可用，但 webhook 只是占位，没有形成完整补偿闭环
- Stripe 代码存在，但还没达到与 PayPal 同等级的生产可用度
- 部分旧文档与当前实现不完全一致，容易误导后续复制

---

## 3. 登录系统的技术实现

### 3.1 登录方式

当前项目主要接入：

- Google OAuth
- 邮箱密码登录/注册

实现核心在 `public/js/auth.js`。

### 3.2 登录链路

标准流程如下：

1. 页面加载 Supabase JS SDK。
2. `auth.js` 创建全局单例 `supabaseClient`。
3. 配置 `persistSession`、`autoRefreshToken`、`detectSessionInUrl`。
4. 用户点击 Google 登录后，跳转到 Supabase Auth 托管的 OAuth 流程。
5. Google 授权完成后，回跳当前页面。
6. 前端通过 `exchangeCodeForSession()` 或 `getSession()` 恢复会话。
7. 登录态恢复后更新页面 UI，并拉取当前用户额度。

### 3.3 当前实现里做得比较对的地方

- 有本地会话缓存 `lastKnownSession`，减少偶发 session 读取失败对 UI 的影响
- 有 `getFreshSession()`，在 token 快过期时主动刷新
- 有 `restoreSessionFromUrl()`，专门处理 OAuth 回跳参数
- 登录完成后会立即刷新额度和用户菜单，而不是只改一个“已登录”按钮

### 3.4 用户资料与赠送额度的建模

用户资料不只依赖 `auth.users`，而是扩展了自己的 `public.users` 表，里面保存：

- `credits_balance`
- `free_sessions_remaining`
- `total_sessions`
- `email`

用户首次注册后，数据库通过 `handle_new_user()` 自动创建业务用户记录。  
同时，`chat` 函数里还有 `ensureUserRecord()` 做兜底，防止因为触发器异常导致“Auth 有用户、业务表没记录”。

这个设计非常值得复用，因为：

- Auth 身份和业务字段分离更清晰
- 以后加会员等级、黑名单、来源渠道、风控字段更方便
- 出现脏数据时有双保险

### 3.5 登录系统最容易踩坑的地方

#### 坑 1：OAuth 回调地址没一次配全

要同时配置：

- Supabase `Site URL`
- Supabase `Redirect URLs`
- Google Cloud Console 的 OAuth redirect URI
- 生产域名、预发域名、Cloudflare Pages 域名

如果只配了正式域名，预发一测就会报错。  
如果只配根域名，不配页面路径或通配，也经常会因为 `redirectTo` 是当前页面地址而失败。

#### 坑 2：前端实际使用的域名不唯一

当前项目既有：

- `pages.dev`
- 自定义域名
- 本地 IP / localhost

只要前端代码里 `redirectTo` 跟 Supabase 允许列表不一致，就会反复测试。  
以后一定要先确定“唯一主域名”和“允许测试域名清单”。

#### 坑 3：用户已登录，但业务表没有对应记录

如果只依赖注册触发器，不做业务层兜底，后续会出现：

- 登录成功，但查额度失败
- 页面显示已登录，但无法开始会话
- 支付成功后找不到用户档案

当前项目的双保险做法是对的，后续继续保留。

### 3.6 登录系统复用建议

以后类似项目，登录系统建议固定为下面这套：

- Supabase Auth 负责身份
- `public.users` 负责业务档案
- 前端统一封装：
  - `getCurrentSession`
  - `getFreshSession`
  - `restoreSessionFromUrl`
  - `onAuthStateChange`
- 所有页面只消费这一层封装，不直接到处写 `supabase.auth.xxx`

这样做的好处是：

- 登录相关 bug 只修一个文件
- 以后换 Google、Apple、Email Link 也更容易扩展
- 页面不会各自维护一套会话逻辑

---

## 4. 支付与额度系统的技术实现

### 4.1 当前支付模型

本项目不是订阅制，而是“额度包 + 新会话扣额度”的模型：

- 新用户赠送 2 次免费会话
- 免费次数用完后，新会话消耗 2 credits
- 充值包：
  - Basic：$0.99 / 10 credits
  - Pro：$4.99 / 60 credits

### 4.2 数据层设计

数据库核心表：

- `users`
  - 当前余额、剩余免费次数、累计会话数
- `orders`
  - 每笔充值订单
- `credit_transactions`
  - 每次充值/扣减/赠送流水
- `conversations`
  - 会话内容与阶段状态

这是一个很适合复用的最小闭环：

- `orders` 负责“钱”
- `credit_transactions` 负责“账”
- `users` 负责“余额”

三者职责清楚，后续审计、退款、补偿都更方便。

### 4.3 PayPal 当前主链路

前端流程：

1. 定价页点击购买
2. `public/js/paypal-payment.js` 校验登录态
3. 动态加载 PayPal SDK
4. 调用 `payment-paypal/create-order`
5. Edge Function 创建 PayPal 订单，并写入本地 `orders` 表，状态为 `pending`
6. 用户在 PayPal 窗口完成付款
7. 前端调用 `payment-paypal/capture-order`
8. 服务端捕获订单
9. 服务端将订单置为 `completed`
10. 服务端调用 `add_credits()` 给用户加积分
11. 前端刷新额度显示

### 4.4 聊天计费链路

聊天的计费思路比“先扣费再生成”更好，当前逻辑是：

1. 用户准备开始新会话
2. 前端先调用 `/payment/credits` 预检查剩余免费次数/积分
3. 如果看起来可开始，则允许发第一条消息
4. `chat` 函数先 `previewConversationSession()` 再调用 DeepSeek
5. 只有在首条 AI 回复有效生成后，才 `finalizeConversationSession()`
6. 如果计费落账失败，则回滚本次新建对话

这套设计非常值得保留，因为它解决了两个体验问题：

- 用户不会因为 AI 接口失败而白白被扣次数/积分
- 新会话是否收费由服务端最终裁定，不依赖前端判断

### 4.5 当前实现里值得保留的亮点

#### 亮点 1：预检查 + 服务端最终确认

前端预检查只是为了提前给提示，不是为了做最终安全判断。  
真正是否允许开始新会话，仍然由 `chat` 函数最终确认。

这是正确的架构思路。

#### 亮点 2：支付订单先落库，再跳第三方支付

很多项目是支付成功后才补写订单，后面特别难追。  
当前项目是先写本地订单，再走第三方支付，后续排错会轻松很多。

#### 亮点 3：`payment_intent_id` / PayPal order id 作为外部对账键

这个字段非常关键，后续：

- 查单
- 补单
- 对账
- 退款
- 防重

都离不开它。

---

## 5. 当前项目里需要特别注意的风险点

下面这些不是“代码不能跑”，而是“后面容易反复测、反复修”的地方。

### 5.1 PayPal 已付款但本地加积分失败的风险

当前 `payment-paypal/capture-order` 里是：

1. 先更新 `orders.status = completed`
2. 再调用 `add_credits()`

问题是这两步不是一个数据库事务。  
如果订单状态改成功了，但 `add_credits()` 失败，就会出现：

- PayPal 已扣款
- 订单显示 completed
- 用户却没拿到积分

这类问题最难处理，因为它不是简单重试前端就能自动恢复。

### 5.2 PayPal webhook 目前没有形成真正的补偿闭环

当前 webhook 更偏“占位”和日志记录，没有把“支付完成但前端 capture 回调异常”的情况完整兜住。

这意味着：

- 用户支付成功
- 前端网络中断或页面关闭
- `capture-order` 没完成

系统未必能自动补单。

### 5.3 Stripe 代码是预留状态，不建议直接当生产主链路

当前 `public/js/payment.js` 和 `supabase/functions/payment/index.ts` 更像预埋方案，和当前主项目链路不完全一致。

尤其要注意：

- 前端 `create-payment-intent` 仍以 `plan + userId` 传入
- 这套实现没有完全对齐当前 PayPal 那种“先严格校验登录态，再由服务端主导订单创建”的安全模型
- webhook 幂等保护也不够完整

结论：

- 现在可以保留 Stripe 代码作为草稿
- 但以后复制项目时，不要把它默认视为“已生产可用”

### 5.4 配置项分散，后续很容易改漏

当前配置散落在多个地方，例如：

- Supabase URL / anon key
- PayPal Client ID
- 前端页面文案里的回调说明
- 各个 md 文档里的示例地址

以后改域名、改 Supabase 项目、换支付商户时，很容易出现：

- 页面能登录，支付不行
- 支付能下单，回跳不行
- 本地能测，线上失败

### 5.5 文档与代码存在轻微脱节

仓库里部分旧文档仍保留了过去阶段的信息，例如：

- Stripe/PayPal webhook 地址表述不完全一致
- 某些发布说明已经落后于当前实际功能
- 个别文档仍带有旧部署路径或旧页面路径

这不会马上导致线上故障，但非常容易让后续复用的人走错路。

---

## 6. 怎么避免踩坑，怎么一次性做到位

这一部分最适合以后直接照着执行。

### 6.1 先冻结“唯一真相源”

在开始开发前，先一次性确定以下内容：

- 主域名
- 预发域名
- Supabase 项目 URL
- Supabase Auth 回调域名
- PayPal sandbox / live 商户
- Stripe test / live 商户
- 当前项目唯一价格表

然后把这些统一收口到一个配置文件或一个配置生成脚本里。  
不要让这些信息分散在 5 个 JS 文件和 6 个 Markdown 文档里。

### 6.2 登录一定先打通，再做支付

推荐顺序：

1. 先把 Supabase Auth 打通
2. 再确认 `users` 表自动建档
3. 再确认登录后额度查询成功
4. 最后再接支付

不要边改登录边接支付。  
因为支付所有后续问题，本质上都依赖“用户身份能稳定拿到”。

### 6.3 支付一定采用“服务端主导订单”

固定原则：

- 前端只负责发起
- 前端不能决定金额、不能决定 credits、不能决定给谁加余额
- 服务端根据 plan 查价格表并创建订单
- 服务端在确认支付成功后落账

这条原则以后不要变。

### 6.4 把“支付完成”和“余额到账”做成一个原子动作

推荐以后升级成数据库事务型 RPC，例如：

- `complete_paypal_order(order_id, provider_payload)`
- `complete_stripe_payment(payment_intent_id, provider_payload)`

这个 RPC 内部一次完成：

1. 校验订单状态
2. 校验是否已完成
3. 更新订单状态
4. 写 credit transaction
5. 更新 users 余额

要么全部成功，要么全部失败。  
这样就不会出现“钱扣了但积分没到”的半成功状态。

### 6.5 webhook 不是可选项，应该当补偿机制

更稳定的方案不是“只靠前端 capture”，而是：

- 前端 capture：给用户即时反馈
- webhook：做最终补偿和对账

标准做法：

- 前端流程成功时，用户马上看到余额更新
- webhook 如果晚到，只做幂等确认，不重复加积分
- 前端流程失败时，webhook 还能补单

### 6.6 所有外部支付回调都必须做幂等

支付系统一定会重试、超时、重复推送。  
所以必须具备：

- 订单唯一外部键
- 已完成订单不可重复入账
- webhook 可重复调用但不会重复加余额
- 手动补单也不会重复加余额

没有幂等，就会进入反复测试、偶发双倍加额度、偶发不到账的循环。

### 6.7 测试要按“链路”测，不要按“页面”测

推荐测试顺序：

1. 登录成功
2. `users` 建档成功
3. 免费次数展示正确
4. 新会话首条回复成功后免费次数减少
5. 免费次数耗尽后，未充值不能新建会话
6. PayPal 下单成功
7. PayPal capture 成功
8. `orders` 正确变为 `completed`
9. `credit_transactions` 写入成功
10. `users.credits_balance` 增加成功
11. 使用 credits 开启新会话后，余额正确减少

如果按这个顺序测，一次就能定位是哪一层出问题，而不是“页面看起来怪怪的”。

---

## 7. 更稳定的优化方案

下面这些方案比当前实现更稳，适合以后直接作为标准模板。

### 7.1 建立统一配置中心

建议新增一个统一配置层，例如：

- `public/js/app-config.js`
- 或 `public/config.json`
- 或由构建脚本生成 `window.APP_CONFIG`

至少统一收口：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `PAYPAL_CLIENT_ID`
- `APP_ENV`
- `APP_DOMAIN`
- `PRICING_PLANS`

这样以后换项目时只改一个地方。

### 7.2 把价格表固定在服务端

价格表不要前后端各写一份。  
推荐：

- 服务端保存唯一价格表
- 前端展示从服务端拉取，或者至少由同一份配置生成

否则会出现：

- 页面显示 10 credits
- 服务端实际加 8 credits

这种对账事故非常难看。

### 7.3 订单状态机标准化

建议把订单状态统一收敛为：

- `pending`
- `authorized`
- `completed`
- `failed`
- `refunded`

并明确每个状态的进入条件。  
以后补单、退款、对账都会更稳。

### 7.4 聊天计费继续保持“成功首答后扣费”

这套逻辑建议保留，不建议退回“发第一条消息就先扣费”。

因为当前模式的优点很明显：

- 用户体验更公平
- AI 异常不会误扣
- 定价逻辑更容易解释

如果以后想进一步稳定，可以把“新会话首答成功”也做成数据库 RPC，避免会话写入和扣费分成两段。

### 7.5 增加补单与对账后台能力

建议至少准备 3 个后台动作：

- 根据订单号查询当前本地状态
- 根据第三方订单号手动补发 credits
- 将异常订单标记为待人工处理

哪怕只是一个临时 SQL + 一个内部管理页面，都会大幅减少线上焦虑。

### 7.6 收紧生产环境 CORS 和来源域名

当前函数普遍是 `Access-Control-Allow-Origin: *`。  
开发期方便，但生产更稳的做法是白名单：

- 正式域名
- 预发域名
- 本地域名

这样更安全，也更容易排查恶意来源调用。

### 7.7 日志要带订单号/用户 ID/会话 ID

以后每个关键链路日志至少带：

- `user_id`
- `conversation_id`
- `order_id`
- `payment_provider_order_id`
- `request_id`

这样真正出问题时，不需要靠猜。

---

## 8. 后续复用时建议采用的标准模板

### 8.1 推荐的固定架构

- 静态前端：Cloudflare Pages
- Auth / DB / Functions：Supabase
- AI：单独 Edge Function 转发
- 支付：PayPal 或 Stripe 二选一优先做深做稳
- 额度：`users + orders + credit_transactions`
- 新会话计费：首条 AI 成功后扣费

### 8.2 推荐的固定模块

- `auth.js`
  - 登录、登出、会话恢复、会话刷新、Auth UI 更新
- `billing.js`
  - 额度查询、支付入口、订单状态刷新
- `chat.js`
  - 会话状态、AI 请求、错误提示、阶段 UI
- `app-config.js`
  - 全局配置

### 8.3 推荐的固定数据库对象

- 表：
  - `users`
  - `orders`
  - `credit_transactions`
  - `conversations`
- RPC：
  - `start_conversation_session`
  - `complete_payment_order`
  - `refund_payment_order`

### 8.4 推荐的固定部署顺序

1. 建 Supabase 项目
2. 跑 migration
3. 配 Auth Provider
4. 打通登录
5. 部署 Edge Functions
6. 接支付 sandbox
7. 测完整充值链路
8. 接 Cloudflare Pages 正式域名
9. 配 webhook
10. 切 live

---

## 9. 一次性验收清单

以后做类似网站，建议上线前逐条打勾。

### 9.1 登录验收

- [ ] Google OAuth 可以从正式域名正常回跳
- [ ] 预发域名也可正常回跳
- [ ] 邮箱登录/注册可用
- [ ] 登录后 `users` 表自动建档
- [ ] 刷新页面后会话仍可恢复
- [ ] token 快过期时可自动刷新
- [ ] 登录后页面能正确显示免费次数/credits

### 9.2 支付验收

- [ ] 未登录不能发起购买
- [ ] 登录后可以创建订单
- [ ] 第三方支付成功后本地订单能更新
- [ ] 用户余额会正确到账
- [ ] 同一订单重复回调不会重复加余额
- [ ] 支付成功但前端中断时可通过 webhook 或补单恢复
- [ ] 退款流程至少有手工补偿方案

### 9.3 会话计费验收

- [ ] 免费次数剩余时，新会话首答成功后减少免费次数
- [ ] 免费次数用尽且余额不足时，不能开始新会话
- [ ] 余额足够时，新会话首答成功后扣 2 credits
- [ ] AI 失败时不扣次数/积分
- [ ] 新会话失败回滚后，不残留脏会话数据

### 9.4 部署验收

- [ ] Cloudflare Pages 部署地址正确
- [ ] 自定义域名生效
- [ ] Supabase Redirect URLs 配齐
- [ ] Google OAuth redirect URI 配齐
- [ ] PayPal sandbox/live 环境没有混用
- [ ] 所有环境变量都有文档
- [ ] 健康检查接口可用

---

## 10. 对当前项目的结论

从 MVP 到可运营产品的角度看，这个项目已经具备了比较完整的闭环：

- 静态站点部署简单
- 登录链路基本正确
- 会话、额度、订单三条主线已经建立
- PayPal 主支付链路已经打通
- AI 对话与业务计费已经有合理边界

真正还需要升级的，不是“再加更多功能”，而是把以下 3 件事做稳：

1. 配置统一化  
避免以后换域名、换项目、换商户时反复改漏。

2. 支付原子化与幂等化  
避免出现“扣款成功但积分没到”或“重复到账”。

3. webhook 补偿闭环  
避免前端成功链路以外的异常订单无人兜底。

如果这 3 件事补齐，这套架构就已经足够作为之后类似 AI 工具站的标准模板复用。

---

## 11. 最建议你后续直接复用的结论

如果以后再做类似网站，最推荐直接复制的是这套原则：

- 前端静态化，后端能力全部收敛到 Supabase
- 登录统一走 Supabase Auth，不自己造认证
- 用户业务档案单独建 `users` 表
- 订单、流水、余额三张表分开
- 新会话只在“首条 AI 有效回复成功后”扣费
- 支付一定由服务端主导，不信任前端金额
- webhook 一定做成补偿，不只是通知
- 所有外部支付回调都必须幂等
- 所有环境配置只保留一个真相源

这套做法比“能跑就行”的方案更稳，也更适合以后重复复用。
