const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Polyfill fetch for older Node.js
if (!globalThis.fetch) {
  globalThis.fetch = require('node-fetch');
}

const db = require('./db.cjs');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

// Load skill content
const SKILL_PATH = path.join(__dirname, '../src/data/skill.md');
let skillContent = '';
try {
  skillContent = fs.readFileSync(SKILL_PATH, 'utf-8');
  console.log(`Loaded skill: ${skillContent.length} chars`);
} catch (e) {
  console.warn('Warning: skill.md not found at', SKILL_PATH);
}

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-5b7dacf1cc7f4066a0a0d7bb8f082c5b';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

console.log('Environment check:');
console.log('  DEEPSEEK_API_KEY exists:', !!DEEPSEEK_API_KEY);
console.log('  DEEPSEEK_API_KEY length:', DEEPSEEK_API_KEY.length);

// ==================== API Routes ====================

app.get('/api/conversations', (req, res) => {
  res.json(db.getConversations());
});

app.get('/api/conversations/:id', (req, res) => {
  const conv = db.getConversation(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  res.json(conv);
});

app.post('/api/conversations', (req, res) => {
  const { title } = req.body;
  const id = db.createConversation(title);
  res.status(201).json({ id });
});

// Chat — SSE streaming
app.post('/api/chat', async (req, res) => {
  const { messages, conversationId } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // 语言检测函数
  function detectLanguage(text) {
    const chineseRegex = /[\u4e00-\u9fff]/;
    const englishRegex = /[a-zA-Z]/;
    
    let chineseCount = 0;
    let englishCount = 0;
    
    for (const char of text) {
      if (chineseRegex.test(char)) {
        chineseCount++;
      } else if (englishRegex.test(char)) {
        englishCount++;
      }
    }
    
    if (chineseCount > englishCount * 2 && chineseCount > 0) {
      return 'chinese';
    } else if (englishCount > chineseCount * 2 && englishCount > 0) {
      return 'english';
    }
    return 'english';
  }
  
  // 获取用户最后一条消息
  const lastUserMessage = messages[messages.length - 1]?.content || '';
  const detectedLanguage = detectLanguage(lastUserMessage);
  
  // 构建语言特定的系统提示
  let languageInstruction = '';
  if (detectedLanguage === 'chinese') {
    languageInstruction = `\n\n# 当前对话语言：中文\n你正在与使用中文的用户对话。请务必使用中文回复，保持专业、清晰的表达。`;
  } else if (detectedLanguage === 'english') {
    languageInstruction = `\n\n# Current Conversation Language: English\nYou are conversing with a user who is using English. Please respond in English, maintaining professional and clear expression.`;
  } else {
    languageInstruction = `\n\n# Current Conversation Language: Detected as ${detectedLanguage}\nPlease respond in the same language as the user's message.`;
  }
  
  const systemPrompt = `You are "First Principles", an AI thinking guide. You MUST follow the skill instructions below exactly. This is your core identity — you are NOT a generic chatbot. Never skip the framework.

# Language Detection & Response Rule
CRITICAL: You MUST detect the language of the user's last message and respond in the SAME language.
- If the user writes in Chinese, respond in Chinese
- If the user writes in English, respond in English
- If the user writes in another language, respond in that language
- If the user mixes languages, respond in the primary language used
- Never force English if the user is using another language

${languageInstruction}

${skillContent}`;

  try {
    const apiKey = DEEPSEEK_API_KEY.trim();
    console.log('API Key being used:', apiKey.substring(0, 10) + '...');
    console.log('Authorization header:', `Bearer ${apiKey.substring(0, 10)}...`);
    
    const requestBody = {
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: false,
    };
    
    console.log('Request body size:', JSON.stringify(requestBody).length, 'chars');
    
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errText = await response.text();
      console.error('DeepSeek API error details:', response.status, errText.substring(0, 200));
      res.write(`data: ${JSON.stringify({ error: 'AI service unavailable' })}\n\n`);
      res.end();
      return;
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
    
    // Save to DB
    let convId = conversationId;
    const userMsg = messages[messages.length - 1]?.content || '';
    if (!convId) {
      convId = db.createConversation(userMsg.slice(0, 80));
      res.write(`data: ${JSON.stringify({ conversationId: convId })}\n\n`);
    }
    db.addMessage(convId, 'user', userMsg);
    db.addMessage(convId, 'assistant', message);
    if (messages.length <= 1) {
      db.updateTitle(convId, userMsg.slice(0, 80));
    }

    // 发送完整响应
    res.write(`data: ${JSON.stringify({ content: message })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Chat error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Internal server error' })}\n\n`);
      res.end();
    }
  }
});

// Generate mindmap
app.post('/api/mindmap', async (req, res) => {
  const { conversation_id, summary } = req.body;
  if (!conversation_id) return res.status(400).json({ error: 'conversation_id required' });

  const conv = db.getConversation(conversation_id);
  if (!conv) return res.status(404).json({ error: 'Not found' });

  const messages = conv.messages.map(m => `${m.role}: ${m.content}`).join('\n');

  const prompt = `Based on this first-principles thinking conversation, generate a Mermaid mindmap in YAML format.

Conversation:
${messages}

Generate exactly this format (use Chinese labels, keep each node under 20 chars):

mindmap
  root(("真实问题"))
    原始困惑
      用户初始问题简述
    被打破的假设
      假设1
      假设2
    关键洞察
      洞察1
      洞察2
    真实根因
      根因描述
    行动计划
      立即行动
      本周目标
      长期方向

Output ONLY the mermaid code block between triple backticks with "mermaid" tag.`;

  try {
    const apiKey = DEEPSEEK_API_KEY.trim();
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('Mindmap API error:', response.status);
      return res.status(500).json({ error: 'AI service error' });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';

    const match = content.match(/```mermaid\s*\n([\s\S]*?)```/);
    if (match) content = match[1].trim();

    const mindmapId = db.saveMindmap(conversation_id, content);
    res.json({ id: mindmapId, mindmap: content });
  } catch (err) {
    console.error('Mindmap error:', err.message);
    res.status(500).json({ error: 'Failed to generate mindmap' });
  }
});

// Get usage
app.get('/api/usage', (req, res) => {
  const used = db.getUsageCount();
  const total = 3;
  res.json({ used, total, remaining: Math.max(0, total - used), price_per_session: 1, currency: 'USD' });
});

// ==================== Static files ====================

const publicDir = path.resolve(__dirname, 'public-placeholder');
app.use(express.static(publicDir));

function serveHTML(filename) {
  return (req, res) => {
    const filePath = path.join(publicDir, filename);
    if (fs.existsSync(filePath)) {
      res.type('html').send(fs.readFileSync(filePath, 'utf-8'));
    } else {
      res.status(404).send('Not found');
    }
  };
}

app.get('/chat/:id', serveHTML('chat.html'));
app.get('/mindmap/:id', serveHTML('mindmap.html'));
app.get('/history', serveHTML('history.html'));
app.get('/about', serveHTML('about.html'));

const PORT = process.env.PORT || 4322;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`  Local:  http://localhost:${PORT}`);
  console.log(`  Public: http://43.153.79.127:${PORT}`);
  console.log(`  API:    http://${HOST}:${PORT}/api/chat`);
  console.log(`  DB:     SQLite at /tmp/fp-db.sqlite3`);
});
