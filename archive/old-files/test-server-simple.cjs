// 简单测试服务器基本功能

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 4322,
  path: '/api/usage',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log(`状态码: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('响应数据:', data);
    
    // 测试前端页面
    console.log('\n测试前端页面访问...');
    http.get('http://localhost:4322', (pageRes) => {
      console.log(`前端页面状态码: ${pageRes.statusCode}`);
      if (pageRes.statusCode === 200) {
        console.log('✅ 前端页面可访问');
      } else {
        console.log('❌ 前端页面不可访问');
      }
    }).on('error', (err) => {
      console.error('前端页面错误:', err.message);
    });
  });
});

req.on('error', (err) => {
  console.error('请求错误:', err.message);
});

req.end();