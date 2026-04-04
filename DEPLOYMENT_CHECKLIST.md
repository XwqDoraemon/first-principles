# First Principles Supabase 部署检查清单

## ✅ 已完成
- [x] 项目架构迁移到 Supabase
- [x] 数据库 Schema 设计完成
- [x] Edge Functions 开发完成
- [x] 部署脚本准备就绪
- [x] 文档和配置模板创建
- [x] 本地开发环境运行正常

## 🔄 待完成（需要您的输入）

### 1. Supabase 账户和令牌
- [ ] **Supabase 账户**: 注册/登录 https://app.supabase.com
- [ ] **访问令牌**: 生成并复制 Access Token
  - 位置: Account → Access Tokens → Generate New Token
  - 名称: "First Principles Deployment"

### 2. DeepSeek API 密钥
- [ ] **DeepSeek 账户**: 注册/登录 https://platform.deepseek.com
- [ ] **API 密钥**: 生成并复制 API Key
  - 位置: API Keys → Create New API Key
  - 权限: 确保有 chat completions 权限

### 3. 域名配置（可选）
- [ ] **自定义域名**: 如 firstprinciples.ai
- [ ] **DNS 配置**: 将域名指向 Supabase 项目
- [ ] **SSL 证书**: Supabase 自动提供

## 🚀 部署步骤

### 阶段 1: 环境准备
1. **提供 Supabase 访问令牌**
   ```bash
   # 我将运行:
   supabase login
   # 输入您提供的访问令牌
   ```

2. **提供 DeepSeek API 密钥**
   - 我将配置到环境变量中

### 阶段 2: 项目创建
1. **创建 Supabase 项目**
   ```bash
   supabase projects create first-principles \
     --db-password "您的安全密码" \
     --region "ap-southeast-1" \
     --plan free
   ```

2. **获取项目配置**
   - 项目 URL (SUPABASE_URL)
   - 匿名密钥 (SUPABASE_ANON_KEY)
   - 服务角色密钥 (SUPABASE_SERVICE_ROLE_KEY)

### 阶段 3: 部署执行
1. **配置环境变量**
   ```bash
   cd supabase
   cp .env.deployment .env
   # 编辑 .env 文件，填入实际值
   ```

2. **运行部署脚本**
   ```bash
   ./deploy.sh
   # 选择选项 2 (链接到现有项目)
   # 输入项目引用 ID
   ```

3. **验证部署**
   ```bash
   # 测试健康检查
   curl https://your-project.supabase.co/functions/v1/health
   
   # 测试聊天功能
   curl -X POST https://your-project.supabase.co/functions/v1/chat \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"测试"}],"userId":"test"}'
   ```

### 阶段 4: 前端启动
1. **配置前端环境**
   ```bash
   cd /root/.openclaw/workspace-developer-xue/first-principles
   cp supabase/.env .env
   ```

2. **启动前端服务器**
   ```bash
   node server/supabase-server.cjs
   ```

3. **访问应用**
   - 本地: http://localhost:4322
   - 公网: http://43.153.79.127:4322

## 📊 部署后验证

### 功能测试
- [ ] 健康检查 API 返回正常
- [ ] 聊天功能正常工作
- [ ] 数据库连接正常
- [ ] 思维导图生成正常
- [ ] 用户认证正常（如启用）

### 性能测试
- [ ] 响应时间 < 5 秒
- [ ] 并发连接正常
- [ ] 错误率 < 1%
- [ ] 资源使用正常

### 安全验证
- [ ] HTTPS 强制启用
- [ ] CORS 配置正确
- [ ] API 密钥安全存储
- [ ] 数据库 RLS 启用

## 🔧 故障排除

### 常见问题
1. **数据库连接失败**
   - 检查数据库密码
   - 验证网络连接
   - 检查防火墙设置

2. **Edge Function 部署失败**
   - 检查环境变量
   - 查看部署日志
   - 验证函数代码

3. **API 调用失败**
   - 检查 API 密钥
   - 验证配额限制
   - 检查网络连接

### 紧急联系人
- **Supabase 支持**: https://supabase.com/docs/support
- **DeepSeek 支持**: support@deepseek.com
- **项目维护者**: 您（Boss）

## 📈 监控和维护

### 日常监控
- **响应时间**: 监控 API 响应时间
- **错误率**: 跟踪错误请求比例
- **使用量**: 监控 API 调用次数
- **成本**: 跟踪云服务费用

### 定期维护
- **每周**: 检查日志，清理临时文件
- **每月**: 更新依赖，安全审计
- **每季度**: 性能优化，架构评估

### 备份策略
- **数据库**: 自动每日备份
- **代码**: GitHub 仓库备份
- **配置**: 环境变量备份

## 💰 成本估算

### 免费层（预计 $0-10/月）
- Supabase: 免费（500MB 数据库，5GB 带宽）
- DeepSeek API: $0-10（取决于使用量）

### 专业层（预计 $30-80/月）
- Supabase Pro: $25/月
- DeepSeek API: $5-55/月

### 扩展建议
- 用户数 < 1000: 免费层足够
- 用户数 1000-10000: 考虑专业层
- 用户数 > 10000: 需要定制方案

## 🎯 成功标准

### 技术标准
- [ ] 应用稳定运行 30 天无重大故障
- [ ] 平均响应时间 < 3 秒
- [ ] 可用性 > 99.5%
- [ ] 安全漏洞数量 = 0

### 业务标准
- [ ] 用户满意度 > 90%
- [ ] 日活跃用户 > 100
- [ ] 用户留存率 > 40%
- [ ] 功能使用率 > 70%

## 📞 支持渠道

### 技术支持
- **GitHub Issues**: 代码问题
- **Supabase Discord**: 平台问题
- **DeepSeek 论坛**: API 问题

### 用户支持
- **帮助文档**: /about 页面
- **用户反馈**: 应用内反馈
- **社区支持**: Discord 社区

---

**请提供以下信息开始部署：**

1. **Supabase 访问令牌**: `________________`
2. **DeepSeek API 密钥**: `________________`
3. **数据库密码建议**: `________________`
4. **首选部署区域**: □ ap-southeast-1 □ us-east-1 □ eu-west-1

收到信息后，我将立即开始部署流程。