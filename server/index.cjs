
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// ==================== 配置 ====================
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bmstklfbnyevuyxidmhv.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_wnQx8LZ7qUgVAsVOaEnuVQ_Ede5tM3w';
const PORT = 4322;
const HOST = process.env.HOST || '0.0.0.0';

process.env.PORT = PORT;

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

// ==================== 静态文件服务（最先注册）====================
const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir, { index: 'index.html' }));

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

// 路由：HTML 页面
app.get('/chat/:id', serveHTML('chat.html'));
app.get('/mindmap/:id', serveHTML('mindmap.html'));
app.get('/history', serveHTML('history.html'));
app.get('/about', serveHTML('about.html'));
app.get('/pricing', serveHTML('pricing.html'));
app.get('/chat', serveHTML('chat.html'));
app.get('/', serveHTML('index.html'));

// ==================== Supabase 健康检查代理 ====================
app.get('/api/health', async (req, res) => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to connect to Supabase',
      error: error.message 
    });
  }
});

// ==================== 启动服务器 ====================
const server = app.listen(PORT, HOST, () => {
  console.log('\n✅ First Principles Server 已启动');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🌐 公网访问: http://43.153.79.127:${PORT}`);
  console.log(`📍 本地访问: http://localhost:${PORT}`);
  console.log(`🔧 Supabase API: ${SUPABASE_URL}/functions/v1/chat`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 架构: Astro 前端 + Supabase 后端 (无服务器)`);
  console.log(`💾 数据库: Supabase PostgreSQL (云端)`);
  console.log(`🚀 已移除本地 SQLite，完全使用 Supabase\n`);
});

server.on('error', (error) => {
  console.error('\n❌ First Principles Server 启动失败');
  console.error(`错误类型: ${error.code || 'UNKNOWN'}`);
  console.error(`错误信息: ${error.message}`);

  if (error.code === 'EADDRINUSE') {
    console.error(`提示: 端口 ${PORT} 已被占用，请先停止旧进程`);
  }

  if (error.code === 'EACCES' || error.code === 'EPERM') {
    console.error(`提示: 当前环境没有权限监听 ${HOST}:${PORT}`);
  }

  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('\n❌ 未捕获异常导致服务退出');
  console.error(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('\n❌ 未处理的 Promise 拒绝导致服务异常');
  console.error(reason);
  process.exit(1);
});
