# First Principles - 第一性原理思维助手

## 🚀 快速启动

```bash
cd /root/.openclaw/workspace-developer-xue/first-principles
npm run dev
```

访问: http://43.153.79.127:4322

## 📋 架构说明

**无服务器架构 (Serverless)**：
- **前端**: Astro (本地开发，端口 4322)
- **后端**: Supabase Edge Functions (云端)
- **数据库**: Supabase PostgreSQL (云端)
- **AI**: DeepSeek API (外部调用)

### 已移除
- ❌ 本地 SQLite 数据库
- ❌ Express API 路由（/api/chat 等）
- ❌ 本地数据存储

### 现在使用
- ✅ Supabase Edge Functions
- ✅ Supabase PostgreSQL 云端数据库
- ✅ 完全无服务器架构

## 🎯 核心功能

- ✅ 聊天对话（基于 Supabase Edge Functions）
- ✅ 语言自动检测（中/英）
- ✅ AI 以相同语言回复
- ✅ 对话历史存储在云端
- ✅ 思维导图生成

## 🔧 环境配置

`.env` 文件已配置：
```bash
SUPABASE_URL=https://bmstklfbnyevuyxidmhv.supabase.co
SUPABASE_ANON_KEY=sb_publishable_wnQx8LZ7qUgVAsVOaEnuVQ_Ede5tM3w
DEEPSEEK_API_KEY=sk-5b7dacf1cc7f4066a0a0d7bb8f082c5b
PORT=4322
```

## 📁 项目结构

```
first-principles/
├── server/
│   ├── index.cjs              # Express 静态文件服务（已简化）
│   ├── public-placeholder/     # 静态 HTML 文件
│   │   ├── chat.html          # 聊天界面（使用 Supabase）
│   │   ├── history.html       # 历史记录
│   │   └── about.html         # 关于页面
│   └── db.cjs                 # 已删除（不再使用）
├── supabase/                  # Supabase 配置
│   └── functions/             # Edge Functions
│       ├── chat/              # 聊天功能
│       ├── health/            # 健康检查
│       └── mindmap/           # 思维导图
├── src/                       # Astro 源代码
├── .env                       # 环境变量
└── package.json               # 项目配置
```

## 🌐 访问地址

- **聊天界面**: http://43.153.79.127:4322/chat.html
- **历史记录**: http://43.153.79.127:4322/history
- **关于页面**: http://43.153.79.127:4322/about

## 🔌 API 端点（Supabase Edge Functions）

- `POST https://bmstklfbnyevuyxidmhv.supabase.co/functions/v1/chat`
- `GET https://bmstklfbnyevuyxidmhv.supabase.co/functions/v1/health`

## 📚 文档

- `FINAL_ARCHITECTURE.md` - 最终架构说明
- `FIRST-PRINCIPLES-MVP.md` - 产品需求
- `SKILL.md` - AI 思维框架

## 🎉 迁移完成

**2026-04-07**: 已完全迁移到 Supabase 无服务器架构

- ✅ 移除本地 SQLite 数据库
- ✅ 简化 Express 服务器（仅静态文件）
- ✅ 前端直接调用 Supabase Edge Functions
- ✅ 数据存储在云端 Supabase PostgreSQL

---

**版本**: 3.0.0 (Supabase Serverless) | **更新**: 2026-04-07
