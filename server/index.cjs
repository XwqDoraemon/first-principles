const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const db = require('./db.cjs');
const crewaiBridge = require('./crewai-bridge.cjs');

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

// Initialize CrewAI bridge
(async () => {
  try {
    await crewaiBridge.startService();
    console.log('CrewAI bridge initialized');
  } catch (error) {
    console.warn('Failed to initialize CrewAI bridge:', error.message);
    console.warn('CrewAI features will be disabled');
  }
})();

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

// ==================== CrewAI API Endpoints ====================

/**
 * @api {post} /api/crewai/chat Start CrewAI thinking session
 * @apiParam {String} message User's problem or question
 * @apiParam {String} [conversation_id] Existing conversation ID
 * @apiParam {String} [phase] Phase override (anchor|assumptions|root_cause|solution|mindmap)
 */
app.post('/api/crewai/chat', async (req, res) => {
  try {
    const { message, conversation_id, phase } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
    
    const result = await crewaiBridge.runThinkingSession(message, conversation_id);
    
    if (result.success) {
      res.status(202).json(result); // 202 Accepted (processing)
    } else {
      res.status(500).json(result);
    }
    
  } catch (error) {
    console.error('CrewAI chat error:', error);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${error.message}`
    });
  }
});

/**
 * @api {get} /api/crewai/status/:session_id Get session status
 */
app.get('/api/crewai/status/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;
    const result = await crewaiBridge.getSessionStatus(session_id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
    
  } catch (error) {
    console.error('CrewAI status error:', error);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${error.message}`
    });
  }
});

/**
 * @api {get} /api/crewai/sessions List recent sessions
 * @apiQuery {Number} [limit=10] Maximum number of sessions to return
 */
app.get('/api/crewai/sessions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const result = await crewaiBridge.listSessions(limit);
    
    res.json(result);
    
  } catch (error) {
    console.error('CrewAI sessions error:', error);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${error.message}`
    });
  }
});

/**
 * @api {get} /api/crewai/health Health check
 */
app.get('/api/crewai/health', async (req, res) => {
  try {
    const result = await crewaiBridge.healthCheck();
    
    const statusCode = result.status === 'healthy' ? 200 :
                      result.status === 'degraded' ? 206 : 503;
    
    res.status(statusCode).json(result);
    
  } catch (error) {
    console.error('CrewAI health error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @api {post} /api/crewai/cancel/:session_id Cancel session
 */
app.post('/api/crewai/cancel/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;
    
    // Note: Cancellation not fully implemented yet
    res.json({
      success: false,
      error: 'Session cancellation not yet implemented',
      session_id,
      message: 'Please wait for the session to complete or restart the server'
    });
    
  } catch (error) {
    console.error('CrewAI cancel error:', error);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${error.message}`
    });
  }
});

// ==================== Hybrid Chat Endpoint ====================

/**
 * @api {post} /api/chat/hybrid Hybrid chat (CrewAI + DeepSeek)
 * Uses CrewAI for structured thinking, DeepSeek for final response
 */
app.post('/api/chat/hybrid', async (req, res) => {
  try {
    const { messages, conversationId } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }
    
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return res.status(400).json({ error: 'Last message must be from user' });
    }
    
    const userInput = lastMessage.content;
    
    // Start CrewAI thinking
    const crewaiResult = await crewaiBridge.runThinkingSession(userInput, conversationId);
    
    if (!crewaiResult.success) {
      // Fall back to regular DeepSeek chat
      console.log('CrewAI failed, falling back to DeepSeek');
      return handleRegularChat(req, res);
    }
    
    // Set up SSE for streaming updates
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    const sessionId = crewaiResult.session_id;
    
    // Send initial response
    res.write(`data: ${JSON.stringify({
      type: 'crewai_started',
      session_id: sessionId,
      message: 'Starting first principles thinking...',
      phase: 'anchor'
    })}\n\n`);
    
    // Poll for updates
    const pollInterval = setInterval(async () => {
      try {
        const status = await crewaiBridge.getSessionStatus(sessionId);
        
        if (status.success) {
          res.write(`data: ${JSON.stringify({
            type: 'crewai_update',
            ...status
          })}\n\n`);
          
          if (status.completed) {
            clearInterval(pollInterval);
            
            // Get final result and send as DeepSeek-style response
            const finalResult = status.data;
            if (finalResult) {
              const summary = `Based on first principles thinking:\n\n` +
                            `**Problem:** ${finalResult.problem_statement?.core_problem || 'Not defined'}\n\n` +
                            `**Key Insights:** ${finalResult.root_cause_analysis?.first_principles?.join(', ') || 'None'}\n\n` +
                            `**Recommended Solution:** ${finalResult.solution_design?.recommended_approach?.description || 'Not available'}`;
              
              res.write(`data: ${JSON.stringify({
                type: 'final_response',
                content: summary,
                session_id: sessionId
              })}\n\n`);
            }
            
            res.write('data: [DONE]\n\n');
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        clearInterval(pollInterval);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: error.message
        })}\n\n`);
        res.write('data: [DONE]\n\n');
      }
    }, 2000); // Poll every 2 seconds
    
    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      res.write('data: [DONE]\n\n');
    }, 300000);
    
  } catch (error) {
    console.error('Hybrid chat error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ error: `Internal server error: ${error.message}` });
    } else {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message
      })}\n\n`);
      res.write('data: [DONE]\n\n');
    }
  }
});

// Helper function for regular chat (fallback)
async function handleRegularChat(req, res) {
  // This would be the existing /api/chat logic
  // For now, just return an error
  res.status(500).json({ error: 'CrewAI service unavailable and no fallback configured' });
}

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

/**
 * @api {post} /api/crewai/chat Start CrewAI thinking session
 * @apiParam {String} message User's problem or question
 * @apiParam {String} [conversation_id] Existing conversation ID
 * @apiParam {String} [phase] Phase override (anchor|assumptions|root_cause|solution|mindmap)
 */
app.post('/api/crewai/chat', async (req, res) => {
  try {
    const { message, conversation_id, phase } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
    
    const result = await crewaiBridge.runThinkingSession(message, conversation_id);
    
    if (result.success) {
      res.status(202).json(result); // 202 Accepted (processing)
    } else {
      res.status(500).json(result);
    }
    
  } catch (error) {
    console.error('CrewAI chat error:', error);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${error.message}`
    });
  }
});

/**
 * @api {get} /api/crewai/status/:session_id Get session status
 */
app.get('/api/crewai/status/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;
    const result = await crewaiBridge.getSessionStatus(session_id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
    
  } catch (error) {
    console.error('CrewAI status error:', error);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${error.message}`
    });
  }
});

/**
 * @api {get} /api/crewai/sessions List recent sessions
 * @apiQuery {Number} [limit=10] Maximum number of sessions to return
 */
app.get('/api/crewai/sessions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const result = await crewaiBridge.listSessions(limit);
    
    res.json(result);
    
  } catch (error) {
    console.error('CrewAI sessions error:', error);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${error.message}`
    });
  }
});

/**
 * @api {get} /api/crewai/health Health check
 */
app.get('/api/crewai/health', async (req, res) => {
  try {
    const result = await crewaiBridge.healthCheck();
    
    const statusCode = result.status === 'healthy' ? 200 :
                      result.status === 'degraded' ? 206 : 503;
    
    res.status(statusCode).json(result);
    
  } catch (error) {
    console.error('CrewAI health error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @api {post} /api/crewai/cancel/:session_id Cancel session
 */
app.post('/api/crewai/cancel/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;
    
    // Note: Cancellation not fully implemented yet
    res.json({
      success: false,
      error: 'Session cancellation not yet implemented',
      session_id,
      message: 'Please wait for the session to complete or restart the server'
    });
    
  } catch (error) {
    console.error('CrewAI cancel error:', error);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${error.message}`
    });
  }
});

// ==================== Hybrid Chat Endpoint ====================

/**
 * @api {post} /api/chat/hybrid Hybrid chat (CrewAI + DeepSeek)
 * Uses CrewAI for structured thinking, DeepSeek for final response
 */
app.post('/api/chat/hybrid', async (req, res) => {
  try {
    const { messages, conversationId } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }
    
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return res.status(400).json({ error: 'Last message must be from user' });
    }
    
    const userInput = lastMessage.content;
    
    // Start CrewAI thinking
    const crewaiResult = await crewaiBridge.runThinkingSession(userInput, conversationId);
    
    if (!crewaiResult.success) {
      // Fall back to regular DeepSeek chat
      console.log('CrewAI failed, falling back to DeepSeek');
      return handleRegularChat(req, res);
    }
    
    // Set up SSE for streaming updates
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    const sessionId = crewaiResult.session_id;
    
    // Send initial response
    res.write(`data: ${JSON.stringify({
      type: 'crewai_started',
      session_id: sessionId,
      message: 'Starting first principles thinking...',
      phase: 'anchor'
    })}\n\n`);
    
    // Poll for updates
    const pollInterval = setInterval(async () => {
      try {
        const status = await crewaiBridge.getSessionStatus(sessionId);
        
        if (status.success) {
          res.write(`data: ${JSON.stringify({
            type: 'crewai_update',
            ...status
          })}\n\n`);
          
          if (status.completed) {
            clearInterval(pollInterval);
            
            // Get final result and send as DeepSeek-style response
            const finalResult = status.data;
            if (finalResult) {
              const summary = `Based on first principles thinking:\n\n` +
                            `**Problem:** ${finalResult.problem_statement?.core_problem || 'Not defined'}\n\n` +
                            `**Key Insights:** ${finalResult.root_cause_analysis?.first_principles?.join(', ') || 'None'}\n\n` +
                            `**Recommended Solution:** ${finalResult.solution_design?.recommended_approach?.description || 'Not available'}`;
              
              res.write(`data: ${JSON.stringify({
                type: 'final_response',
                content: summary,
                session_id: sessionId
              })}\n\n`);
            }
            
            res.write('data: [DONE]\n\n');
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        clearInterval(pollInterval);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: error.message
        })}\n\n`);
        res.write('data: [DONE]\n\n');
      }
    }, 2000); // Poll every 2 seconds
    
    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      res.write('data: [DONE]\n\n');
    }, 300000);
    
  } catch (error) {
    console.error('Hybrid chat error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ error: `Internal server error: ${error.message}` });
    } else {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message
      })}\n\n`);
      res.write('data: [DONE]\n\n');
    }
  }
});

// Helper function for regular chat (fallback)
async function handleRegularChat(req, res) {
  // This would be the existing /api/chat logic
  // For now, just return an error
  res.status(500).json({ error: 'CrewAI service unavailable and no fallback configured' });
}

const PORT = process.env.PORT || 4322;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`  Local:  http://localhost:${PORT}`);
  console.log(`  Public: http://43.153.79.127:${PORT}`);
  console.log(`  API:    http://${HOST}:${PORT}/api/chat`);
  console.log(`  CrewAI: http://${HOST}:${PORT}/api/crewai/chat`);
  console.log(`  DB:     SQLite at /tmp/fp-db.sqlite3`);
});
