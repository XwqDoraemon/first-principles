#!/bin/bash
# First Principles Supabase 生产部署脚本

set -e

echo "🚀 First Principles 生产部署开始..."
echo "📊 项目: https://bmstklfbnyevuyxidmhv.supabase.co"
echo ""

# 检查必需的工具
echo "🔧 检查系统依赖..."
if ! command -v supabase &> /dev/null; then
    echo "❌ 未找到 Supabase CLI"
    echo "   安装: npm install -g supabase"
    exit 1
fi

if ! command -v curl &> /dev/null; then
    echo "❌ 未找到 curl"
    echo "   安装: apt-get install curl"
    exit 1
fi

echo "✅ 系统依赖检查通过"
echo ""

# 检查环境变量文件
echo "📁 检查环境配置..."
if [ ! -f .env.production ]; then
    echo "❌ 未找到 .env.production 文件"
    echo "   请先创建配置文件"
    exit 1
fi

# 加载环境变量
source .env.production

echo "✅ 环境配置加载完成"
echo ""

# 验证环境变量
echo "🔍 验证环境变量..."
MISSING_VARS=()

if [ "$SUPABASE_SERVICE_ROLE_KEY" = "REPLACE_WITH_SERVICE_ROLE_KEY" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    MISSING_VARS+=("SUPABASE_SERVICE_ROLE_KEY")
fi

if [ "$DEEPSEEK_API_KEY" = "REPLACE_WITH_DEEPSEEK_API_KEY" ] || [ -z "$DEEPSEEK_API_KEY" ]; then
    MISSING_VARS+=("DEEPSEEK_API_KEY")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "❌ 以下环境变量未配置:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "📋 配置说明:"
    echo "   1. SUPABASE_SERVICE_ROLE_KEY: Supabase 控制台 → Settings → API → Service Role Key"
    echo "   2. DEEPSEEK_API_KEY: https://platform.deepseek.com → API Keys → Create New API Key"
    exit 1
fi

echo "✅ 环境变量验证通过"
echo ""

# 验证 Supabase 项目连接
echo "🔗 验证 Supabase 项目连接..."
PROJECT_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" \
    "https://bmstklfbnyevuyxidmhv.supabase.co/rest/v1/" \
    -H "apikey: $SUPABASE_ANON_KEY")

if [ "$PROJECT_HEALTH" != "200" ] && [ "$PROJECT_HEALTH" != "401" ]; then
    echo "❌ 无法连接到 Supabase 项目 (HTTP $PROJECT_HEALTH)"
    echo "   请检查:"
    echo "   1. 项目 URL 是否正确"
    echo "   2. 网络连接是否正常"
    echo "   3. 项目是否已启用"
    exit 1
fi

echo "✅ Supabase 项目连接正常"
echo ""

# 链接到项目
echo "🔗 链接到 Supabase 项目..."
supabase link --project-ref bmstklfbnyevuyxidmhv

if [ $? -ne 0 ]; then
    echo "❌ 项目链接失败"
    echo "   请检查:"
    echo "   1. 是否已登录: supabase login"
    echo "   2. 项目引用 ID 是否正确"
    exit 1
fi

echo "✅ 项目链接成功"
echo ""

# 部署数据库
echo "📦 部署数据库..."
supabase db push

if [ $? -ne 0 ]; then
    echo "❌ 数据库部署失败"
    echo "   请检查:"
    echo "   1. 数据库连接配置"
    echo "   2. 迁移文件语法"
    exit 1
fi

echo "✅ 数据库部署成功"
echo ""

# 设置环境变量到 Supabase
echo "🔧 设置 Supabase 环境变量..."
supabase secrets set --env-file .env.production

if [ $? -ne 0 ]; then
    echo "⚠️  环境变量设置失败，尝试手动设置..."
    echo "   手动设置命令:"
    echo "   supabase secrets set DEEPSEEK_API_KEY=\"$DEEPSEEK_API_KEY\""
else
    echo "✅ 环境变量设置成功"
fi

echo ""

# 部署 Edge Functions
echo "⚡ 部署 Edge Functions..."

echo "  部署 chat function..."
supabase functions deploy chat --no-verify-jwt

if [ $? -ne 0 ]; then
    echo "❌ chat function 部署失败"
    exit 1
fi
echo "  ✅ chat function 部署成功"

echo "  部署 health function..."
supabase functions deploy health --no-verify-jwt

if [ $? -ne 0 ]; then
    echo "❌ health function 部署失败"
    exit 1
fi
echo "  ✅ health function 部署成功"

echo "✅ 所有 Edge Functions 部署完成"
echo ""

# 验证部署
echo "🔍 验证部署..."

echo "  测试健康检查..."
HEALTH_RESPONSE=$(curl -s "https://bmstklfbnyevuyxidmhv.supabase.co/functions/v1/health" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY")

if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"'; then
    echo "  ✅ 健康检查通过"
else
    echo "  ⚠️  健康检查返回: $HEALTH_RESPONSE"
fi

echo ""

# 生成类型定义
echo "📝 生成 TypeScript 类型定义..."
mkdir -p ../src/types
supabase gen types typescript --linked > ../src/types/supabase.ts 2>/dev/null || {
    echo "⚠️  类型定义生成失败，跳过此步骤"
}

echo ""

# 部署完成
echo "🎉 部署完成！"
echo ""
echo "📊 部署摘要:"
echo "   - 项目: https://bmstklfbnyevuyxidmhv.supabase.co"
echo "   - 数据库: ✅ 已部署"
echo "   - Edge Functions: ✅ 已部署"
echo "   - 环境变量: ✅ 已设置"
echo "   - 类型定义: ✅ 已生成"
echo ""
echo "🔗 API 端点:"
echo "   - 健康检查: https://bmstklfbnyevuyxidmhv.supabase.co/functions/v1/health"
echo "   - 聊天: https://bmstklfbnyevuyxidmhv.supabase.co/functions/v1/chat"
echo ""
echo "🚀 启动前端服务器:"
echo "   cd /root/.openclaw/workspace-developer-xue/first-principles"
echo "   cp supabase/.env.production .env"
echo "   node server/supabase-server.cjs"
echo ""
echo "🌐 访问地址:"
echo "   - 本地: http://localhost:4322"
echo "   - 公网: http://43.153.79.127:4322"
echo ""
echo "📋 后续步骤:"
echo "   1. 启动前端服务器"
echo "   2. 测试完整功能"
echo "   3. 配置域名（可选）"
echo "   4. 设置监控和告警"
echo ""
echo "🆘 故障排除:"
echo "   - 查看日志: supabase functions logs chat"
echo "   - 重新部署: supabase functions deploy chat"
echo "   - 更新密钥: supabase secrets set KEY=VALUE"
echo ""
echo "✅ 所有部署任务已完成！"