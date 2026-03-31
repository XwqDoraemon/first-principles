# First Principles — MVP Document

## 1. 项目概述

**产品名称:** First Principles
**一句话描述:** 基于第一性原理思维 + 大模型的 AI 思维引导工具。用户提出问题后，AI 不直接给答案，而是通过结构化的苏格拉底式追问，引导用户层层拆解假设、追溯根本事实、自己重建解决方案。

**核心价值:** 不是给你答案，而是帮你找到答案。

---

## 2. 目标用户

- 18-45 岁英语用户
- 面临职业决策、人生选择、创业方向、关系困境、效率瓶颈
- 对"表面建议"不满、渴望深度思考的人
- 建议受众: 创业者、产品经理、技术负责人、独立开发者、自由职业者

---

## 3. 核心功能

### 3.1 第一性原理引导对话

用户输入问题后，AI 按以下五阶段引导：

| 阶段 | 目标 | 轮数 |
|------|------|------|
| **0 - 定锚** | 理解问题真意，声明流程 | 1-2 |
| **1 - 挖假设** | 打破"理所当然"的前提假设 | 2-4 |
| **2 - 触底溯源** | 5 Why 追问到基本事实 | 2-3 |
| **3 - 重建方案** | 从零开始推导解决方案 | 1-2 |
| **4 - 检验行动** | 验证假设 + 确定第一步 | 1 |
| **5 - 总结脑图** | 结构化输出 + 交互式思维导图 | 必做 |

总计约 8-15 轮对话，以脑图收尾。

### 3.2 思维导图生成

对话完成后自动生成结构化脑图，包含：

- 🧠 **认知转变轴:** 原始问题 → 真实问题（一眼看到思维跃迁）
- 🔴🟡⬫🔵 **四色分支:** 核心问题 / 干扰因素 / 伪问题 / 次要问题
- ✕ **被打破的假设:** 关键洞察展示
- 💡 **关键洞察引用:** 用户自己说出的那句话
- ⚠️ **风险提示:** 方案最可能的失败原因
- 🎯 **行动时间轴:** 今天 / 本周 / 长期

### 3.3 特殊情境处理

- 用户不耐烦 → 立即给出进度感
- 用户陷入循环 → 温和拉回 + 命名模式
- 用户跑偏 → 判断类型（逃避型 vs 发现型 vs 相关型）
- 用户情绪激动 → 暂停引导，先接住情绪
- 多方向问题 → 树形探索 → 关联分析 → 收敛核心

---

## 4. 技术架构

### 4.1 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Astro 6 + Tailwind CSS | 静态站点，极快加载 |
| UI 组件 | 原型 HTML/CSS | 参考用户提供的 Clarity UI 原型 |
| 思维导图 | Mermaid.js 或 D3.js | 前端渲染交互式脑图 |
| 部署 | Cloudflare Pages | 免费 + 全球 CDN + 自动 HTTPS |
| 后端 | Cloudflare Workers | API 代理 + 大模型调用 |
| LLM | DeepSeek Chat (主) / GLM-5-Turbo (备) | 思维引导核心引擎 |
| 认证 | Cloudflare Zero Trust | 简单邮箱/社交登录 |
| 数据库 | Cloudflare D1 (SQLite) | 对话历史存储 |

### 4.2 系统流程

```
用户输入问题
     │
     ▼
┌─────────────┐
│  Cloudflare   │ ← Cloudflare Pages 静态前端
│  Pages       │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Cloudflare   │ ← Cloudflare Worker (API)
│  Worker      │
│             ├──→ 解析用户问题，判断是否触发 first-principles skill
│             ├──→ 组装 system prompt (注入 SKILL.md 引导规则)
│             ├──→ 调用 DeepSeek Chat (主) / GLM-5-Turbo (备)
│             ├──→ 接收 AI 回复，流式输出给前端
│             └──→ 对话结束 → 生成脑图 → 存入 D1
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  OpenAI     │
│  GPT-4o    │
└─────────────┘
```

### 4.3 API 设计

```
POST /api/chat

Request:
{
  "messages": [
    { "role": "system", "content": "[SKILL.md 内容]" },
    { "role": "user", "content": "用户输入的问题" }
  ],
  "model": "deepseek-chat",
  "stream": true
}

Response (SSE Stream):
  {
    "choices": [{ "delta": { "content": "..." } }]
  }
```

```
POST /api/mindmap

Request:
{
  "conversation_id": "uuid",
  "summary": "思维复盘结论"
}

Response:
{
  "mindmap_data": { /* Mermaid / D3 data */ }
}
```

### 4.4 数据模型 (Cloudflare D1)

```sql
-- 对话表
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 消息表
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id),
  role TEXT, -- user / assistant / system
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 脑图存储 (JSON)
CREATE TABLE mindmaps (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id),
  data TEXT NOT NULL, -- 脑图结构数据
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. 前端页面设计

### 5.1 页面结构

参考用户提供的 Clarity UI 原型，极简设计：

- **主页:** 输入框 + 标题 + 简介 + 历史对话列表
- **对话页:** 全屏对话界面 + 右侧/底部实时脑图预览
- **脑图页:** 全屏交互式思维导图（对话结束后生成，可编辑）
- **关于页:** 产品理念 + 第一性原理思维简介

### 5.2 对话界面

- 类似 ChatGPT 的气泡对话布局
- AI 消息中高亮关键问题（加粗/引用框）
- 进度指示器（阶段 0-5）
- "跳过引导，直接给建议" 按钮（随时可用）
- 对话结束按钮 → 触发脑图生成

### 5.3 脑图展示

- **交互式节点:** 点击展开/折叠
- **颜色编码:** 🔴核心 🟡干扰 ⬫伪问题 🔵次要
- **认知转变轴:** 顶部对比展示
- **行动时间轴:** 底部 Today → This Week → Long-term
- 导出为 SVG / PNG / Mermaid

---

## 6. Skill 设计（核心 AI 逻辑）

第一性原理引导规则已定义在 `SKILL.md` 中（约 440 行），核心要点：

### 6.1 角色定义

- **不是** 给用户答案的顾问
- **不是** 讲课的老师
- **是** 苏格拉底式的思维向导
- 每次只问一个问题
- 用用户自己的词汇
- 对沉默保持耐心

### 6.2 五阶段流程

1. **定锚** → 确认问题真意，声明流程
2. **挖假设** → 识别"理所当然"的前提
3. **触底** → 5 Why 追问到根因
4. **重建** → 从零推导方案
5. **总结** → 文字复盘 + 交互式脑图（必做）

### 6.3 特殊处理

- 跑偏判断：逃避型（温和拉回） vs 发现型（跟着走）
- 多方向：树形探索 → 关联分析 → 收敛
- 情绪激动：暂停引导，先接住情绪
- 用户失去耐心：主动小结，重建方向感

---

## 7. 商业模式

### 7.1 定价策略

| 方案 | 价格 | 说明 |
|------|------|------|
| 免费体验 | $0 | 每人 3 次 AI 对话 + 1 次脑图 |
| 按次付费 | $1/次 | 超出免费次数后，每次对话 $1 |
| Pro | $9/月 | 无限对话 + 脑图 + 历史回顾 |

### 7.2 收入预估（月活 1000 人）

| 来源 | 收入 |
|------|------|
| Pro 订阅 (100 人) | $900 |
| 按次付费 (200 人 × 10 次/月) | $200 |
| **月收入** | **$1,100** |

### 7.3 成本估算

| 项目 | 月成本 |
|------|------|
| Cloudflare Pages + Workers + D1 | ~$0 (免费额度内) |
| DeepSeek Chat (主) / GLM-5-Turbo (备) | ~$100-300 |
| 域名 | ~$1/月 |
| **月成本** | **~$101-301** |

**首月成本 < $300 即可启动。**

---

## 8. MVP 范围

### ✅ MVP 包含

- 首页 + 对话界面 + 脑图生成
- 5 阶段引导流程完整实现
- 特殊情境处理（跑偏/情绪/不耐烦）
- 思维导图生成（Mermaid）
- 历史对话列表
- 响应式设计（移动端适配）
- 基础 SEO

### ❌ MVP 不包含

- 用户注册/登录（用 Cloudflare Zero Trust 快速验证）
- 多语言（仅英文）
- 社区功能
- 分享功能（后续）
- 移动 App（后续）

---

## 9. 开发路线图

### Phase 1 — MVP（2-3 周）

- [ ] 前端框架搭建（Astro + Tailwind）
- [ ] Cloudflare Worker API（聊天接口）
- [ ] OpenAI API 集成（GPT-4o）
- [ ] SKILL.md 集成到 system prompt
- [ ] 对话流程实现（5 阶段状态机）
- [ ] 脑图生成（Mermaid.js）
- [ ] Cloudflare D1 对话存储
- [ ] 基础 UI（参考 Clarity 原型）

### Phase 2 — 优化（2 周）

- [ ] Cloudflare Zero Trust 登录
- [ ] Stripe 支付集成
- [ ] 对话历史回顾功能
- [ 脑图导出（SVG/PNG）
- [ ] 性能优化（流式输出）
- [ ] 移动端适配优化
- [ ] 用户体验微调（进度指示器等）

### Phase 3 — 增长（持续）

- [ ] 多语言支持
- [ ] 社区/分享功能
- [ A/B 测试定价
- [ ] 移动 App
- [ ] API 开放（供第三方集成）

---

## 10. 技术决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 框架 | Astro | 静态优先，SEO 极佳，性能好，符合极简设计 |
| 部署 | Cloudflare Pages | 免费额度足够，全球 CDN，开发者体验好 |
| API 层 | Cloudflare Workers | 与 Pages 同生态，延迟低，免费额度高 |
| 数据库 | Cloudflare D1 | SQLite 兼容，免费，与 Workers 无缝集成 |
| LLM | DeepSeek Chat 性价比高，中文能力出色 |
| 脑图 | Mermaid.js | 轻量，前端渲染，用户可直接交互 |
| 认证 | Cloudflare Zero Trust | 零代码实现，邮箱登录即可 |

---

## 11. 关键指标

| 指标 | 目标 |
|------|------|
| 对话完成率 | > 70%（用户完成阶段 5 脑图） |
| 平均对话轮数 | 8-15 轮 |
| 脑图满意度 | > 4/5 |
| 7 日留存 | > 30% |
| 付费转化率 | > 5%（免费 → Pro） |

---

## 12. 与竞品差异

| | First Principles | ChatGPT | Claude | Perplexity |
|---|---|---|---|---|
| **不给答案，引导思考** | ✅ 核心定位 | ❌ 直接给答案 | ❌ 直接给答案 | ❌ 直接给答案 |
| **结构化五阶段流程** | ✅ | ❌ | ❌ | ❌ |
| **思维导图输出** | ✅ | ❌ | ❌ | ❌ |
| **进度透明** | ✅ 阶段指示器 | ❌ | ❌ | ❌ |
| **特殊情境处理** | ✅ 跑偏/情绪/循环 | ❌ | ⚠️ 部分 | ❌ |

**核心差异: 别人给你答案，我们帮你找到答案。**
