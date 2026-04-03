// First Principles Supabase 前端服务器
// 这个服务器作为前端代理，连接 Supabase 后端

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

// 环境变量配置
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

// 检查必需的环境变量
if (!SUPABASE_URL.includes('supabase.co') && !SUPABASE_URL.includes('localhost')) {
  console.warn('⚠️  SUPABASE_URL 可能未正确配置:', SUPABASE_URL);
}

if (SUPABASE_ANON_KEY === 'your-anon-key') {
  console.warn('⚠️  SUPABASE_ANON_KEY 使用默认值，请配置正确的密钥');
}

if (!DEEPSEEK_API_KEY) {
  console.warn('⚠️  DEEPSEEK_API_KEY 未配置，聊天功能将无法工作');
}

// ==================== API 代理路由 ====================

// 健康检查
app.get('/api/health', async (req, res) => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/health`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: '无法连接到 Supabase 后端',
      timestamp: new Date().toISOString(),
    });
  }
});

// 聊天代理
app.post('/api/chat', async (req, res) => {
  const { messages, conversationId } = req.body;
  
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // 设置 SSE 流
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    // 调用 Supabase Edge Function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        messages: messages,
        conversationId: conversationId,
        userId: 'demo-user', // 实际应用中应该从认证获取
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase chat error:', response.status, errorText);
      res.write(`data: ${JSON.stringify({ error: '后端服务错误' })}\n\n`);
      res.end();
      return;
    }

    const data = await response.json();
    
    if (data.success) {
      // 流式返回 AI 回复
      const message = data.message || '';
      for (let i = 0; i < message.length; i += 10) {
        const chunk = message.substring(i, i + 10);
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        // 模拟流式效果
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // 发送对话 ID
      if (data.conversationId) {
        res.write(`data: ${JSON.stringify({ conversationId: data.conversationId })}\n\n`);
      }
    } else {
      res.write(`data: ${JSON.stringify({ error: data.error || 'AI 服务错误' })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error('Chat proxy error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: '内部服务器错误' });
    } else {
      res.write(`data: ${JSON.stringify({ error: '内部服务器错误' })}\n\n`);
      res.end();
    }
  }
});

// 获取对话列表
app.get('/api/conversations', async (req, res) => {
  try {
    // 这里应该调用 Supabase REST API 获取用户对话
    // 由于需要用户认证，这里返回示例数据
    res.json([
      {
        id: 'demo-conv-1',
        title: '如何提高工作效率？',
        message_count: 5,
        last_message_at: new Date().toISOString(),
        status: 'active'
      },
      {
        id: 'demo-conv-2',
        title: '职业发展建议',
        message_count: 3,
        last_message_at: new Date(Date.now() - 86400000).toISOString(),
        status: 'active'
      }
    ]);
  } catch (error) {
    console.error('Conversations error:', error);
    res.status(500).json({ error: '获取对话失败' });
  }
});

// 获取特定对话
app.get('/api/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 这里应该调用 Supabase REST API 获取对话详情
    // 返回示例数据
    res.json({
      id: id,
      title: '示例对话',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: '如何提高工作效率？',
          created_at: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: '我会用大约 8-10 个问题一步步引导你，每次只问一个。你随时可以说"直接给建议"跳过引导。我们先从最重要的一个问题开始——你希望提高工作效率之后，你的工作生活会有什么不同？',
          created_at: new Date(Date.now() - 3500000).toISOString()
        }
      ],
      created_at: new Date(Date.now() - 3600000).toISOString(),
      status: 'active'
    });
  } catch (error) {
    console.error('Conversation detail error:', error);
    res.status(500).json({ error: '获取对话详情失败' });
  }
});

// 创建新对话
app.post('/api/conversations', (req, res) => {
  const { title } = req.body;
  const id = `conv-${Date.now()}`;
  
  res.status(201).json({
    id: id,
    title: title || '新对话',
    message_count: 0,
    created_at: new Date().toISOString(),
    status: 'active'
  });
});

// 生成思维导图
app.post('/api/mindmap', async (req, res) => {
  const { conversation_id, summary } = req.body;
  
  if (!conversation_id) {
    return res.status(400).json({ error: 'conversation_id required' });
  }

  try {
    // 这里可以调用 Supabase Edge Function 或直接生成
    const mindmapContent = `mindmap
  root(("真实问题"))
    原始困惑
      用户初始问题简述
    被打破的假设
      假设1: ${summary || '未提供摘要'}
      假设2: 需要更多分析
    关键洞察
      洞察1: 第一性原理思考
      洞察2: 结构化分析
    行动计划
      立即行动: 开始第一步
      本周目标: 验证假设
      长期方向: 持续改进`;

    res.json({
      id: `mindmap-${Date.now()}`,
      mindmap: mindmapContent,
      conversation_id: conversation_id,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Mindmap error:', err.message);
    res.status(500).json({ error: '生成思维导图失败' });
  }
});

// 使用统计
app.get('/api/usage', (req, res) => {
  res.json({
    used: 0,
    total: 100,
    remaining: 100,
    price_per_session: 0,
    currency: 'USD',
    note: 'Supabase 后端版本 - 无使用限制'
  });
});

// ==================== 静态文件服务 ====================

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

// ==================== 服务器启动 ====================

const PORT = process.env.PORT || 4322;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 First Principles 前端服务器运行在 http://${HOST}:${PORT}`);
  console.log(`📡 后端连接: ${SUPABASE_URL}`);
  console.log(`🔗 API 端点:`);
  console.log(`   - 健康检查: http://${HOST}:${PORT}/api/health`);
  console.log(`   - 聊天: http://${HOST}:${PORT}/api/chat`);
  console.log(`   - 对话列表: http://${HOST}:${PORT}/api/conversations`);
  console.log(`   - 思维导图: http://${HOST}:${PORT}/api/mindmap`);
  console.log('');
  console.log('⚙️  架构信息:');
  console.log(`   - 前端: Express 代理服务器`);
  console.log(`   - 后端: Supabase Edge Functions`);
  console.log(`   - AI: DeepSeek API + 第一性原理 Skill`);
  console.log(`   - 数据库: Supabase PostgreSQL`);
  console.log('');
  console.log('⚠️  环境变量检查:');
  console.log(`   - SUPABASE_URL: ${SUPABASE_URL.includes('supabase.co') ? '✅ 已配置' : '⚠️  可能未配置'}`);
  console.log(`   - SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY !== 'your-anon-key' ? '✅ 已配置' : '⚠️  使用默认值'}`);
  console.log(`   - DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY ? '✅ 已配置' : '❌ 未配置'}`);
  console.log('');
  console.log('📋 使用说明:');
  console.log('   1. 确保 Supabase 项目已部署并运行');
  console.log('   2. 配置正确的环境变量');
  console.log('   3. 访问 http://localhost:4322 开始使用');
});