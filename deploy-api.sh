#!/bin/bash

# Cloudflare Pages API 部署脚本
# 直接使用 Cloudflare API 创建和部署

set -e

# 配置
CLOUDFLARE_API_TOKEN="cfat_8aDDCDWXU8eh6Np8YNB8AJiHHAXll5uXQHzKttLg8a15a2ab"
PROJECT_NAME="first-principles"
BUILD_DIR="server/public-placeholder"
ACCOUNT_ID="xuewq983@gmail.com"  # 需要替换为实际的 Account ID

echo "=== Cloudflare Pages API 部署 ==="
echo ""

# 1. 获取 Account ID
echo "🔍 获取 Account ID..."
ACCOUNT_LIST=$(curl -s -X GET "https://api.cloudflare.com/client/v4/accounts" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json")

echo "$ACCOUNT_LIST" | jq -r '.result[] | "\(.id): \(.name)"' 2>/dev/null || echo "$ACCOUNT_LIST"

# 提取第一个 Account ID
ACCOUNT_ID=$(echo "$ACCOUNT_LIST" | jq -r '.result[0].id' 2>/dev/null)

if [ -z "$ACCOUNT_ID" ] || [ "$ACCOUNT_ID" = "null" ]; then
    echo "❌ 无法获取 Account ID，请检查 API Token"
    exit 1
fi

echo "✅ Account ID: $ACCOUNT_ID"
echo ""

# 2. 创建 Pages 项目
echo "📦 创建 Pages 项目..."
CREATE_RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "'$PROJECT_NAME'",
    "production_branch": "main",
    "build_config": {
      "build_caching": true,
      "build_command": "",
      "destination_dir": "server/public-placeholder"
    }
  }')

echo "$CREATE_RESPONSE" | jq '.' 2>/dev/null || echo "$CREATE_RESPONSE"
echo ""

# 3. 创建部署
echo "🚀 创建部署..."
# 首先需要创建上传目录
UPLOAD_DIR=$(mktemp -d)
cp -r "$BUILD_DIR"/* "$UPLOAD_DIR/"

# 创建部署
DEPLOY_RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects/$PROJECT_NAME/deployments" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branch": "main"
  }')

# 提取上传 URL
UPLOAD_URL=$(echo "$DEPLOY_RESPONSE" | jq -r '.result.upload_url' 2>/dev/null)

if [ -z "$UPLOAD_URL" ] || [ "$UPLOAD_URL" = "null" ]; then
    echo "❌ 无法获取上传 URL"
    echo "$DEPLOY_RESPONSE"
    exit 1
fi

echo "✅ 上传 URL: $UPLOAD_URL"
echo ""

# 4. 上传文件（需要使用 wrangler 或其他工具）
echo "📤 准备上传文件..."
echo "文件目录: $UPLOAD_DIR"
echo "项目名称: $PROJECT_NAME"
echo ""

# 使用 wrangler 上传
wrangler pages deploy "$BUILD_DIR" --project-name="$PROJECT_NAME"

echo ""
echo "✅ 部署完成！"
echo ""
echo "🌐 访问地址:"
echo "   https://$PROJECT_NAME.pages.dev"
