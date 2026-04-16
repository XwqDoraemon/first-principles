
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const publicDir = path.resolve(__dirname, './public');

console.log('publicDir:', publicDir);
console.log('exists:', fs.existsSync(publicDir));

// 先添加一个简单的测试路由
app.get('/test', (req, res) => {
  res.send('Test works!');
});

// 然后添加静态文件服务
app.use(express.static(publicDir));

// 最后添加兜底路由
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(4323, () => {
  console.log('Test server running on http://localhost:4323');
});
