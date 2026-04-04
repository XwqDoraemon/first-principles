# 迁移步骤 2.2: 更新前端 API 调用以使用 Supabase

## 问题分析

当前前端代码调用本地 Express API:
```javascript
// ❌ 旧代码 - 调用本地 Express 服务器
const res = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages, conversationId })
});
```

迁移到 Cloudflare 后，需要改为调用 Supabase Edge Functions:
```javascript
// ✅ 新代码 - 直接调用 Supabase Edge Functions
const res = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  },
  body: JSON.stringify({ messages, conversationId, userId })
});
```

## 实施步骤

### 1. 创建 API 客户端工具

创建 `src/lib/api-client.js`:
```javascript
// API 客户端 - 统一管理 Supabase API 调用

const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY;

export class ApiClient {
  constructor() {
    this.baseUrl = SUPABASE_URL;
    this.anonKey = SUPABASE_ANON_KEY;
  }

  async chat(messages, conversationId = null, userId = null) {
    const response = await fetch(`${this.baseUrl}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.anonKey}`
      },
      body: JSON.stringify({
        messages,
        conversationId,
        userId: userId || 'anonymous-user'
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response;
  }

  async getConversations(userId = null, limit = 20) {
    const response = await fetch(
      `${this.baseUrl}/rest/v1/conversations?select=*&order=created_at.desc&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${this.anonKey}`,
          'apikey': this.anonKey
        }
      }
    );

    return response.json();
  }

  async getMessages(conversationId, limit = 50) {
    const response = await fetch(
      `${this.baseUrl}/rest/v1/messages?conversation_id=eq.${conversationId}&select=*&order=created_at.asc&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${this.anonKey}`,
          'apikey': this.anonKey
        }
      }
    );

    return response.json();
  }

  async createConversation(title = 'New Session', userId = null) {
    const response = await fetch(`${this.baseUrl}/rest/v1/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.anonKey}`,
        'apikey': this.anonKey,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        title,
        user_id: userId || null,
        status: 'active'
      })
    });

    return response.json();
  }

  async generateMindmap(conversationId, summary = '') {
    const response = await fetch(`${this.baseUrl}/functions/v1/mindmap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.anonKey}`
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        summary
      })
    });

    return response.json();
  }
}

// 导出单例
export const apiClient = new ApiClient();
```

### 2. 更新聊天页面

修改 `src/pages/chat/[id].astro`:
```javascript
// 在 <script> 标签中替换 API 调用

import { apiClient } from '../../lib/api-client.js';

// 在聊天表单提交中
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = chatInput.value.trim();
  if (!content) return;

  appendMessage('user', content);
  chatInput.value = '';
  sendBtn.textContent = 'Thinking…';
  sendBtn.disabled = true;

  try {
    // 使用新的 API 客户端
    const response = await apiClient.chat(messagesToSend, props.conversationId, 'demo-user');

    if (!response.ok) {
      console.error('API error:', response.status);
      sendBtn.textContent = 'Send →';
      sendBtn.disabled = false;
      return;
    }

    // 读取 SSE 流 (如果使用流式响应)
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let assistantContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      // 处理流式数据
      if (chunk.startsWith('data: ')) {
        const data = chunk.slice(6).trim();
        if (data === '[DONE]') break;

        try {
          const parsed = JSON.parse(data);
          if (parsed.content) {
            assistantContent += parsed.content;
            updateAssistantMessage(assistantContent);
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }

    // 更新 URL
    if (newConversationId && newConversationId !== props.conversationId) {
      window.history.replaceState({}, '', `/chat/${newConversationId}`);
    }

    scrollAnchor.scrollIntoView({ behavior: 'smooth' });

  } catch (error) {
    console.error('Send error:', error);
    appendMessage('assistant', 'Sorry, there was an error processing your message.');
  } finally {
    sendBtn.textContent = 'Send →';
    sendBtn.disabled = false;
    chatInput.focus();
  }
});
```

### 3. 更新其他页面的 API 调用

**历史页面** (`src/pages/history.astro`):
```javascript
// 替换原有的 fetch 调用
import { apiClient } from '../lib/api-client.js';

async function loadHistory() {
  try {
    const conversations = await apiClient.getConversations('demo-user');
    // 渲染对话列表
  } catch (error) {
    console.error('Failed to load history:', error);
  }
}
```

### 4. 移除 Express 特定的代码

删除或注释掉以下内容:
- ❌ `fetch('/api/conversations')`
- ❌ `fetch('/api/chat')`
- ❌ `fetch('/api/mindmap')`
- ❌ `fetch('/api/usage')`

替换为:
- ✅ `apiClient.getConversations()`
- ✅ `apiClient.chat()`
- ✅ `apiClient.generateMindmap()`

### 5. 更新环境变量

创建 `.env.production`:
```bash
# Supabase 配置 (生产环境)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# 应用配置
APP_NAME=First Principles
ENVIRONMENT=production
```

### 6. 测试本地构建

```bash
cd /root/.openclaw/workspace-developer-xue/first-principles

# 安装依赖 (如果需要)
npm install

# 构建静态站点
npm run build

# 本地预览
npm run preview

# 访问 http://localhost:4321 测试
```

### 7. 验证更改

检查清单:
- [ ] 所有 API 调用已更新为使用 `apiClient`
- [ ] 环境变量正确配置
- [ ] 构建成功无错误
- [ ] 本地预览功能正常
- [ ] 控制台无 API 错误

---

**下一步**: 步骤 2.3 - 部署到 Cloudflare Pages