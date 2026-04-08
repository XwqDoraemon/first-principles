#!/bin/bash

# Cloudflare Pages 部署脚本
# 使用 Wrangler CLI 部署到 Cloudflare Pages

set -e

echo "=== Cloudflare Pages 部署脚本 ==="
echo ""

# 配置
PROJECT_NAME="first-principles"
BUILD_DIR="server/public-placeholder"
BRANCH="main"

echo "📦 项目名称: $PROJECT_NAME"
echo "📁 构建目录: $BUILD_DIR"
echo "🌿 分支: $BRANCH"
echo ""

# 检查构建目录是否存在
if [ ! -d "$BUILD_DIR" ]; then
    echo "❌ 错误: 构建目录不存在: $BUILD_DIR"
    exit 1
fi

echo "✅ 构建目录存在"
echo ""

# 使用 wrangler 部署
echo "🚀 开始部署到 Cloudflare Pages..."
echo ""

wrangler pages project create "$PROJECT_NAME" --production-branch="$BRANCH" 2>/dev/null || echo "项目可能已存在，继续部署..."

echo ""
echo "📤 上传文件..."
wrangler pages deploy "$BUILD_DIR" --project-name="$PROJECT_NAME"

echo ""
echo "✅ 部署完成！"
echo ""
echo "🌐 访问地址:"
echo "   https://$PROJECT_NAME.pages.dev"
echo "   或"
echo "   https://$PROJECTNAME.xwqdoraemon.workers.dev"
