const http = require('http');

console.log('=== 测试 first-principle 项目服务 ===\n');

// 测试 1: 检查服务器是否运行
console.log('1. 测试服务器状态...');
const req1 = http.request({
  hostname: 'localhost',
  port: 4322,
  path: '/api/usage',
  method: 'GET'
}, (res) => {
  console.log(`  状态码: ${res.statusCode}`);
  if (res.statusCode === 200) {
    console.log('  ✅ 服务器运行正常');
  } else {
    console.log('  ❌ 服务器有问题');
  }
  
  // 测试 2: 检查前端页面
  console.log('\n2. 测试前端页面...');
  http.get('http://localhost:4322', (res2) => {
    console.log(`  状态码: ${res2.statusCode}`);
    if (res2.statusCode === 200) {
      console.log('  ✅ 前端页面可访问');
    } else {
      console.log('  ❌ 前端页面不可访问');
    }
    
    // 测试 3: 测试聊天API（简单测试）
    console.log('\n3. 测试聊天API连接...');
    const postData = JSON.stringify({
      messages: [{ role: 'user', content: 'Hello test' }],
      conversationId: null
    });
    
    const req3 = http.request({
      hostname: 'localhost',
      port: 4322,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res3) => {
      console.log(`  状态码: ${res3.statusCode}`);
      
      let data = '';
      res3.on('data', (chunk) => {
        data += chunk;
      });
      
      res3.on('end', () => {
        if (res3.statusCode === 200) {
          console.log('  ✅ 聊天API响应正常');
          // 检查是否收到SSE数据
          if (data.includes('data:') && data.includes('content')) {
            console.log('  ✅ 收到SSE流数据');
          } else if (data.includes('error')) {
            console.log('  ⚠️  API返回错误:', data.substring(0, 100));
          }
        } else {
          console.log('  ❌ 聊天API有问题');
        }
        
        console.log('\n=== 测试完成 ===');
        console.log('\n访问地址:');
        console.log('  本地: http://localhost:4322');
        console.log('  公网: http://43.153.79.127:4322');
        console.log('\n功能说明:');
        console.log('  - 已实现语言检测功能：用户使用什么语言，AI就以什么语言回复');
        console.log('  - 支持中文、英文及其他语言');
        console.log('  - 保持了第一性原理思考的核心功能');
      });
    });
    
    req3.on('error', (err) => {
      console.log('  ❌ 聊天API请求失败:', err.message);
    });
    
    req3.write(postData);
    req3.end();
  }).on('error', (err) => {
    console.log('  ❌ 前端页面测试失败:', err.message);
  });
});

req1.on('error', (err) => {
  console.log('  ❌ 服务器状态测试失败:', err.message);
});

req1.end();