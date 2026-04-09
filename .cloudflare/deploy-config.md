# Cloudflare Pages 部署配置

## 架构
- 纯静态前端项目
- 后端 API: Supabase Edge Functions
- 数据库: Supabase PostgreSQL

## 部署配置
- 发布目录: `public/`
- 构建命令: 空（无需构建）
- 框架预设: None

## 关键文件
- `wrangler.toml`: Cloudflare Pages 配置
- `.cloudflare/pages.json`: 部署配置
- `public/`: 静态文件目录

## 为什么这样配置？
避免 Cloudflare Pages 检测到根目录的 `package.json` 后尝试运行 npm install/build
