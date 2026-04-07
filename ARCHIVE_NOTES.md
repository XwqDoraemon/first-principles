# 归档文件说明

本目录包含已归档的旧文件，这些文件属于项目历史的一部分，但已不再使用。

## archive/old-files/

### 服务器相关
- **supabase-server.cjs** - 旧的 Supabase 代理服务器（已不再需要）
- **supabase-config.js** - 旧的 Supabase 客户端配置（已简化）

### 测试脚本
- **test-chat.js** - 旧的聊天 API 测试脚本（调用已移除的本地 API）
- **test-final.cjs** - 旧的后端测试脚本
- **test-server-simple.cjs** - 简单服务器测试脚本

## archive/sqlite-backup/

- **db.cjs.bak** - SQLite 数据库模块备份（已完全迁移到 Supabase）

## archive/ (根目录)

- **README.md** - 旧的项目说明文档
- **DEPLOYMENT.md** - 旧的部署指南文档

## 注意事项

⚠️ **这些文件仅供参考，不应在新代码中使用**

当前架构（2026-04-07 起）：
- ✅ 前端直接调用 Supabase Edge Functions
- ✅ 数据存储在 Supabase PostgreSQL 云端
- ✅ Express 仅用于提供静态文件服务
- ❌ 不再使用本地 SQLite 数据库
- ❌ 不再使用本地 API 路由

---

**归档时间**: 2026-04-07
**架构版本**: 3.0.0 (Supabase Serverless)
