
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 4324;

const publicDir = path.resolve(__dirname, './public');
console.log('publicDir:', publicDir);
console.log('exists:', fs.existsSync(publicDir));

// 测试路由
app.get('/test', (req, res) => {
  res.send('Server is working! Public dir: ' + publicDir);
});

// 静态文件服务
app.use(express.static(publicDir));

app.listen(PORT, () => {
  console.log(`Simple server running on http://localhost:${PORT}`);
});
