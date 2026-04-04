# 迁移步骤 2.1: 更新 Astro 配置为静态输出

## 操作说明

修改 `astro.config.mjs` 文件，将 Astro 从服务器模式改为静态模式。

### 原配置 (服务器模式)
```javascript
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  server: false,
  // ...
});
```

### 新配置 (静态模式)
```javascript
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static', // 静态 HTML 输出
  build: {
    format: 'directory' // 使用目录结构 /about/ 而不是 /about.html
  },
  vite: {
    define: {
      // 注入环境变量
      'import.meta.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY)
    }
  }
});
```

### 为什么这样做？

1. **静态输出**: Cloudflare Pages 托管静态文件，不支持服务器端渲染
2. **目录格式**: 更好的 SEO 和用户体验 (clean URLs)
3. **环境变量**: 在构建时注入 Supabase 配置

### 执行命令

```bash
cd /root/.openclaw/workspace-developer-xue/first-principles

# 备份原配置
cp astro.config.mjs astro.config.mjs.backup

# 更新配置 (需要手动编辑或使用上述新配置)
# nano astro.config.mjs
```

---

**下一步**: 步骤 2.2 - 更新前端 API 调用路径