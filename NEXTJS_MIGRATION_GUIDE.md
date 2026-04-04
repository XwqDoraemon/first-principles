# First Principles - Next.js + Cloudflare + Supabase 架构方案

## 为什么选择 Next.js？

### Next.js vs Astro 对比

| 特性 | Astro | Next.js | 推荐 |
|------|-------|---------|------|
| **生态成熟度** | 较新 | 成熟稳定 | ✅ Next.js |
| **SSR 支持** | 有限 | 强大 | ✅ Next.js |
| **API Routes** | 需要适配器 | 原生支持 | ✅ Next.js |
| **App Router** | 无 | 现代化 | ✅ Next.js |
| **Cloudflare 支持** | 实验性 | 官方支持 | ✅ Next.js |
| **React 生态** | 支持 | 原生 | ✅ Next.js |
| **学习曲线** | 陡峭 | 平缓 | ✅ Next.js |
| **部署灵活性** | 受限 | 极高 | ✅ Next.js |

### Next.js 的核心优势

#### 1. **App Router (Next.js 13+)**
- 文件系统路由（像 Astro 但更强大）
- Server Components 默认
- Streaming 支持
- 并行路由

#### 2. **原生 Cloudflare 支持**
```javascript
// next.config.js
module.exports = {
  output: 'standalone', // 或 'export'
  experimental: {
    runtime: 'edge', // 边缘运行时
  },
}
```

#### 3. **API Routes (可选，用于代理)**
```javascript
// app/api/chat/route.js
export const runtime = 'edge'; // 在 Cloudflare Workers 运行

export async function POST(req) {
  // 可以直接调用 Supabase
  return Response.json(data);
}
```

#### 4. **Server Actions (Next.js 14+)**
```javascript
// 直接在服务端执行，无需 API Routes
async function createChat(formData) {
  'use server';
  // 直接调用 Supabase
  const { data } = await supabase.from('chats').insert({ ... });
  return data;
}
```

## 架构设计

### 方案 A: Next.js + Cloudflare Pages (推荐)

```
┌─────────────────────────────────────────────┐
│          Cloudflare Pages                   │
│  ┌───────────────────────────────────┐     │
│  │   Next.js Static Export           │     │
│  │   (静态 HTML + 客户端 JS)         │     │
│  └───────────────────────────────────┘     │
└───────────────┬─────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│          Supabase 后端                      │
│  ┌──────────────┐      ┌─────────────────┐ │
│  │ Edge Funcs   │      │  PostgreSQL     │ │
│  │ (AI 处理)    │◄────►│  (数据存储)      │ │
│  └──────────────┘      └─────────────────┘ │
└─────────────────────────────────────────────┘
```

**优势**：
- ✅ 纯静态部署，性能最优
- ✅ Cloudflare Pages 自动优化
- ✅ 零服务器成本
- ✅ 全球 CDN

### 方案 B: Next.js + Cloudflare Workers (灵活)

```
┌─────────────────────────────────────────────┐
│      Cloudflare Workers (边缘运行时)         │
│  ┌───────────────────────────────────┐     │
│  │   Next.js Server Components       │     │
│  │   (SSR + API Routes)              │     │
│  └───────────────────────────────────┘     │
└───────────────┬─────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│          Supabase 后端                      │
│  ┌──────────────┐      ┌─────────────────┐ │
│  │ Edge Funcs   │      │  PostgreSQL     │ │
│  │ (AI 处理)    │◄────►│  (数据存储)      │ │
│  └──────────────┘      └─────────────────┘ │
└─────────────────────────────────────────────┘
```

**优势**：
- ✅ 支持 SSR
- ✅ API Routes 在边缘运行
- ✅ 动态内容渲染
- ⚠️ 稍微复杂一些

## 实施方案

### 推荐方案：Next.js Static Export + Cloudflare Pages

#### 为什么选择静态导出？

1. **性能最优**：纯静态 HTML，毫秒级加载
2. **部署简单**：`next build && next export`
3. **成本最低**：完全静态，无服务器成本
4. **可靠性高**：无运行时依赖

#### 适用场景

我们的 First Principles 应用是：
- ✅ 单页应用（SPA）
- ✅ 客户端交互为主
- ✅ 实时数据获取
- ✅ 不需要 SEO（内部工具）

**结论**：静态导出是完美选择！

## 迁移步骤

### 步骤 1: 创建 Next.js 项目

```bash
cd /root/.openclaw/workspace-developer-xue

# 创建新项目
npx create-next-app@latest first-principles-nextjs \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"

cd first-principles-nextjs
```

### 步骤 2: 安装依赖

```bash
# Supabase 客户端
npm install @supabase/supabase-js

# UI 组件库（可选，保持与 Astro 一致的设计）
npm install @radix-ui/react-dialog @radix-ui/react-toast

# 图标库
npm install lucide-react

# 工具库
npm install date-fns
```

### 步骤 3: 项目结构

```
first-principles-nextjs/
├── app/
│   ├── layout.tsx          # 根布局
│   ├── page.tsx            # 首页
│   ├── chat/
│   │   └── [id]/
│   │       └── page.tsx    # 聊天页面
│   ├── history/
│   │   └── page.tsx        # 历史页面
│   └── about/
│       └── page.tsx        # 关于页面
├── components/
│   ├── ChatInterface.tsx   # 聊天界面
│   ├── MessageList.tsx     # 消息列表
│   ├── Sidebar.tsx         # 侧边栏
│   └── MindMap.tsx         # 思维导图
├── lib/
│   ├── supabase.ts         # Supabase 客户端
│   ├── api.ts              # API 调用封装
│   └── types.ts            # TypeScript 类型
├── styles/
│   └── globals.css         # 全局样式
├── public/                 # 静态资源
├── next.config.js          # Next.js 配置
├── tailwind.config.ts      # Tailwind 配置
└── tsconfig.json           # TypeScript 配置
```

### 步骤 4: 核心代码示例

#### 4.1 Supabase 客户端

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 类型定义
export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  status: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}
```

#### 4.2 API 调用封装

```typescript
// lib/api.ts
import { supabase, Message, Conversation } from './supabase';

export async function sendMessage(
  messages: Message[],
  conversationId?: string
): Promise<Response> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        messages,
        conversationId,
        userId: 'demo-user', // 或从认证获取
      }),
    }
  );

  return response;
}

export async function getConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createConversation(title: string): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ title, status: 'active' })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

#### 4.3 聊天界面组件

```typescript
// components/ChatInterface.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { sendMessage } from '@/lib/api';
import { Message } from '@/lib/supabase';

export function ChatInterface({ conversationId }: { conversationId?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      conversation_id: conversationId || 'new',
      role: 'user',
      content: input,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendMessage(
        [...messages, userMessage],
        conversationId
      );

      // 处理流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantContent += parsed.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg?.role === 'assistant') {
                    lastMsg.content = assistantContent;
                  } else {
                    updated.push({
                      id: Date.now().toString(),
                      conversation_id: conversationId || 'new',
                      role: 'assistant',
                      content: assistantContent,
                      created_at: new Date().toISOString(),
                    });
                  }
                  return updated;
                });
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            } mb-4`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-neutral-100'
                  : 'bg-gradient-to-br from-sky-100 to-blue-50'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2 max-w-2xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What's on your mind?"
            rows={3}
            className="flex-1 rounded-xl border border-neutral-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-neutral-900 hover:bg-neutral-800 text-white px-5 py-2.5 rounded-full disabled:opacity-50"
          >
            {isLoading ? 'Thinking…' : 'Send →'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

#### 4.4 聊天页面

```typescript
// app/chat/[id]/page.tsx
import { ChatInterface } from '@/components/ChatInterface';
import { getMessages } from '@/lib/api';

export default async function ChatPage({
  params,
}: {
  params: { id: string };
}) {
  const messages = await getMessages(params.id);

  return (
    <div className="h-screen">
      <ChatInterface conversationId={params.id} />
    </div>
  );
}
```

### 步骤 5: 配置文件

#### 5.1 Next.js 配置

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // 静态导出
  images: {
    unoptimized: true, // Cloudflare Pages 不支持 Next.js 图片优化
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

module.exports = nextConfig;
```

#### 5.2 TypeScript 配置

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

#### 5.3 Tailwind 配置

```javascript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
    },
  },
  plugins: [],
};
export default config;
```

### 步骤 6: 环境变量

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# .env.production
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 步骤 7: 构建和部署

```bash
# 本地开发
npm run dev

# 构建
npm run build

# 本地预览
npm run start

# 导出静态文件
npm run export
```

部署到 Cloudflare Pages:
```bash
# 方式 1: 使用 Wrangler
npx wrangler pages publish out --project-name=first-principles

# 方式 2: 使用 GitHub Actions (推荐)
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: first-principles
          directory: out
```

## Next.js vs Astro 最终对比

| 特性 | Astro | Next.js | 胜者 |
|------|-------|---------|------|
| **学习资源** | 较少 | 丰富 | 🏆 Next.js |
| **社区支持** | 小 | 大 | 🏆 Next.js |
| **就业市场** | 小 | 大 | 🏆 Next.js |
| **Cloudflare 集成** | 实验性 | 官方支持 | 🏆 Next.js |
| **TypeScript** | 需配置 | 原生支持 | 🏆 Next.js |
| **Server Actions** | 无 | 有 | 🏆 Next.js |
| **构建速度** | 快 | 中等 | Astro |
| **包大小** | 小 | 大 | Astro |

### 结论

对于 First Principles 项目，**Next.js 是更好的选择**：

✅ **技术栈更现代**：App Router + Server Components
✅ **生态更成熟**：丰富的第三方库
✅ **Cloudflare 官方支持**：长期维护保证
✅ **团队技能可复用**：React 开发者更多
✅ **未来扩展性更好**：添加 SSR/ISR 零成本

## 迁移时间估算

| 任务 | 时间 | 说明 |
|------|------|------|
| 创建 Next.js 项目 | 30 分钟 | 安装依赖、配置 |
| 迁移组件 | 2-3 小时 | 聊天界面、侧边栏等 |
| API 集成 | 1 小时 | Supabase 客户端 |
| 样式迁移 | 1 小时 | Tailwind 配置 |
| 构建配置 | 30 分钟 | 静态导出配置 |
| 测试和调试 | 1-2 小时 | 功能验证 |
| **总计** | **6-8 小时** | 比 Astro 多 1-2 小时 |

---

**推荐方案：使用 Next.js 静态导出 + Cloudflare Pages**

这是一个更现代化、更可持续的技术选择，长期价值更高。