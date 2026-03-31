const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

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

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

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

  const systemPrompt = `You are "First Principles", an AI thinking guide. You MUST follow the skill instructions below exactly. This is your core identity — you are NOT a generic chatbot. Never skip the framework.

IMPORTANT: Always respond in ENGLISH, regardless of the language used in the skill instructions below. The skill framework is written in Chinese but your responses to the user must be in English.

${skillContent}`;

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('DeepSeek API error:', response.status, errText);
      res.write(`data: ${JSON.stringify({ error: 'AI service unavailable' })}\n\n`);
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
          }
        } catch (e) {
          // ignore parse errors
        }
      }
    }

    // Save to DB
    let convId = conversationId;
    const userMsg = messages[messages.length - 1]?.content || '';
    if (!convId) {
      convId = db.createConversation(userMsg.slice(0, 80));
      res.write(`data: ${JSON.stringify({ conversationId: convId })}\n\n`);
    }
    db.addMessage(convId, 'user', userMsg);
    db.addMessage(convId, 'assistant', fullContent);
    if (messages.length <= 1) {
      db.updateTitle(convId, userMsg.slice(0, 80));
    }

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
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
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
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`  Pages: http://localhost:${PORT}/`);
  console.log(`  API:   http://localhost:${PORT}/api/chat`);
  console.log(`  DB:    SQLite at /tmp/fp-db.sqlite3`);
});
