
const path = require('path');
const fs = require('fs');

console.log('__dirname:', __dirname);
const publicDir = path.resolve(__dirname, '../public');
console.log('publicDir:', publicDir);
console.log('public exists:', fs.existsSync(publicDir));
if (fs.existsSync(publicDir)) {
  console.log('public contents:', fs.readdirSync(publicDir));
}
