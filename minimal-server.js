
const express = require('express');
const path = require('path');

const app = express();
const PORT = 4325;

const publicDir = path.join(__dirname, 'public');
console.log('Serving from:', publicDir);

app.use(express.static(publicDir));

app.listen(PORT, () => {
  console.log(`Minimal server on http://localhost:${PORT}`);
});
