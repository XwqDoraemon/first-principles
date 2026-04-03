#!/bin/bash
# First Principles Supabase 部署脚本

set -e

echo "🚀 开始部署 First Principles 到 Supabase..."

# 检查是否已安装 Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ 未找到 Supabase CLI，请先安装:"
    echo "   npm install -g supabase"
    exit 1
fi

# 检查是否已登录
if ! supabase projects list &> /dev/null; then
    echo "🔑 请先登录 Supabase:"
    echo "   supabase login"
    exit 1
fi

# 选择部署环境
echo "请选择部署环境:"
echo "1) 本地开发 (supabase start)"
echo "2) 链接到现有项目 (supabase link)"
echo "3) 创建新项目 (supabase init)"
read -p "请输入选项 (1-3): " env_choice

case $env_choice in
    1)
        echo "🚀 启动本地 Supabase 开发环境..."
        supabase start
        echo "✅ 本地开发环境已启动"
        echo "📊 访问以下地址:"
        echo "   - Studio: http://localhost:54323"
        echo "   - API: http://localhost:54321"
        ;;
    2)
        read -p "请输入项目引用 ID (project-ref): " project_ref
        echo "🔗 链接到项目: $project_ref"
        supabase link --project-ref "$project_ref"
        echo "✅ 项目链接成功"
        ;;
    3)
        echo "🆕 创建新项目..."
        supabase init
        echo "✅ 新项目已创建"
        ;;
    *)
        echo "❌ 无效选项"
        exit 1
        ;;
esac

# 部署数据库
echo "📦 部署数据库..."
supabase db push

# 部署 Edge Functions
echo "⚡ 部署 Edge Functions..."

echo "  部署 chat function..."
supabase functions deploy chat --no-verify-jwt

echo "  部署 crewai function..."
supabase functions deploy crewai --no-verify-jwt

echo "  部署 health function..."
supabase functions deploy health --no-verify-jwt

# 设置环境变量
echo "🔧 设置环境变量..."
if [ -f .env ]; then
    echo "从 .env 文件读取环境变量..."
    
    # 设置每个 function 的环境变量
    supabase secrets set --env-file .env
    
    # 单独设置重要变量
    if [ -n "$OPENAI_API_KEY" ]; then
        supabase secrets set OPENAI_API_KEY="$OPENAI_API_KEY"
    fi
    
    if [ -n "$DEEPSEEK_API_KEY" ]; then
        supabase secrets set DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY"
    fi
    
    if [ -n "$CREWAI_LOCAL_URL" ]; then
        supabase secrets set CREWAI_LOCAL_URL="$CREWAI_LOCAL_URL"
    fi
else
    echo "⚠️ 未找到 .env 文件，请手动设置环境变量:"
    echo "   supabase secrets set KEY=VALUE"
fi

# 生成类型定义
echo "📝 生成 TypeScript 类型定义..."
supabase gen types typescript --local > ../src/types/supabase.ts

echo "🎉 部署完成！"
echo ""
echo "📊 部署摘要:"
echo "   - 数据库: ✅ 已部署"
echo "   - Edge Functions: ✅ 已部署"
echo "   - 环境变量: ✅ 已设置"
echo "   - 类型定义: ✅ 已生成"
echo ""
echo "🔗 API 端点:"
echo "   - Chat: /functions/v1/chat"
echo "   - CrewAI: /functions/v1/crewai"
echo "   - Health: /functions